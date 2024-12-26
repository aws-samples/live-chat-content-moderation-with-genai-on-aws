import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createRequire } from "module";
const cloudwatch = new CloudWatchClient();
const require = createRequire(import.meta.url);
const https = require("https");
const URL = require("url").URL;

const SSM_PARAMETER_NAME = process.env.SSM_PARAMETER_NAME;
const CACHE_TTL = 60000; // 1 minute in milliseconds
const APPROVED_MESSAGES_TABLE = process.env.APPROVED_MESSAGES_TABLE;
const UNAPPROVED_MESSAGES_TABLE = process.env.UNAPPROVED_MESSAGES_TABLE;
const HALLUCINATIONS_TABLE = process.env.HALLUCINATIONS_TABLE;
const PROMPT_TABLE = process.env.PROMPT_TABLE;
const GUARDRAIL_IDENTIFIER = process.env.GUARDRAIL_IDENTIFIER;
const GUARDRAIL_VERSION = process.env.GUARDRAIL_VERSION;
const DLQ_QUEUE_URL = process.env.DLQ_QUEUE_URL;
const GRAPHQL_API_ENDPOINT = process.env.GRAPHQL_API_ENDPOINT;
const APPSYNC_API_KEY = process.env.APPSYNC_API_KEY;

const ddb = DynamoDBDocument.from(new DynamoDB());
const sqsClient = new SQSClient();
const ssmClient = new SSMClient();

let modelUUIDCache = { value: null, timestamp: 0 };
let promptCache = { value: null, timestamp: 0 };

const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second

const calculateBackoff = (attempt) => {
  const jitter = Math.random() * 1000;
  return Math.min(2 ** attempt * BASE_DELAY + jitter, 10000); // Cap at 10 seconds
};

const getModelUUID = async () => {
  const now = Date.now();
  if (now - modelUUIDCache.timestamp < CACHE_TTL) {
    return modelUUIDCache.value;
  }

  try {
    const response = await ssmClient.send(
      new GetParameterCommand({ Name: SSM_PARAMETER_NAME })
    );
    const newValue = response.Parameter.Value;
    modelUUIDCache = { value: newValue, timestamp: now };

    // Clear prompt cache when model UUID changes
    if (newValue !== modelUUIDCache.value) {
      promptCache = { value: null, timestamp: 0 };
    }

    return newValue;
  } catch (error) {
    console.error("[ERROR] Error fetching model UUID from SSM:", error);
    throw error;
  }
};

const getPrompt = async (modelUUID) => {
  const now = Date.now();
  if (now - promptCache.timestamp < CACHE_TTL && promptCache.value) {
    return promptCache.value;
  }

  try {
    const response = await ddb.get({
      TableName: PROMPT_TABLE,
      Key: { promptId: modelUUID },
    });
    const newPrompt = response.Item;
    promptCache = { value: newPrompt, timestamp: now };
    return newPrompt;
  } catch (error) {
    console.error("[ERROR] Error fetching prompt from DynamoDB:", error);
    throw error;
  }
};

const createConverseCommand = (modelId, config, userMessage) => {
  const { systemPrompt, parameters } = config;

  const baseConfig = {
    modelId,
    messages: [
      {
        role: "user",
        content: [
          {
            text: modelId.startsWith("amazon")
              ? `${systemPrompt}\n\n${userMessage}`
              : userMessage,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: parameters.maxTokens,
      temperature: parameters.temperature,
      topP: parameters.topP,
    },
    guardrailConfig: {
      guardrailIdentifier: GUARDRAIL_IDENTIFIER,
      guardrailVersion: GUARDRAIL_VERSION,
    },
  };

  // Add system prompt for non-Amazon models
  if (!modelId.startsWith("amazon")) {
    baseConfig.system = [{ text: systemPrompt }];
  }

  return new ConverseCommand(baseConfig);
};

const sendToDLQ = async (messageData) => {
  try {
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: DLQ_QUEUE_URL,
        MessageBody: JSON.stringify(messageData),
        MessageGroupId: "default",
      })
    );
  } catch (error) {
    console.error("[ERROR] Error sending message to DLQ:", error);
    throw error;
  }
};

const invokeModelWithRetry = async (
  modelId,
  config,
  userMessage,
  messageData
) => {
  const client = new BedrockRuntimeClient({});

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const command = createConverseCommand(modelId, config, userMessage);
      const response = await client.send(command);

      if (response?.output?.message?.content?.[0]?.text) {
        return response.output.message.content[0].text;
      } else {
        throw new Error("Unexpected response format from Bedrock");
      }
    } catch (error) {
      if (error.name === "ThrottlingException" && attempt < MAX_RETRIES - 1) {
        const delay = calculateBackoff(attempt);
        console.log(
          `[ERROR] Bedrock throttled. Retrying in ${delay}ms. Attempt ${
            attempt + 1
          } of ${MAX_RETRIES}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[ERROR] Failed to process message after ${MAX_RETRIES} attempts. Sending to DLQ.`
        );
        await sendToDLQ(messageData);
        throw error;
      }
    }
  }
};

const createMessageInput = (message) => ({
  messageId: message.messageId,
  userId: message.userId,
  userName: message.userName,
  userMessage: message.userMessage,
  timestamp: message.timestamp,
  bedrockResponse: message.bedrockResponse,
  modelId: message.modelId,
});

const executeGraphQLOperation = async (operationType, message, mutation) => {
  try {
    const result = await makeHttpRequest(
      GRAPHQL_API_ENDPOINT,
      {
        method: "POST",
        headers: {
          "x-api-key": APPSYNC_API_KEY,
        },
      },
      {
        query: mutation,
        variables: { message: createMessageInput(message) },
      }
    );

    if (result.errors) {
      console.error(
        `[ERROR] GraphQL errors in ${operationType}:`,
        JSON.stringify(result.errors, null, 2)
      );
      throw new Error(`[ERROR] Failed to ${operationType}`);
    }

    return result.data[operationType];
  } catch (error) {
    console.error(`[ERROR] Error in ${operationType}:`, error);
    throw error;
  }
};

const broadcastMessage = async (message) => {
  const mutation = `
    mutation BroadcastMessage($message: MessageInput!) {
      broadcastMessage(message: $message) {
        messageId
        userId
        userName
        userMessage
        timestamp
        modelId
      }
    }
  `;

  return executeGraphQLOperation("broadcastMessage", message, mutation);
};

const sendNotification = async (message) => {
  const notificationMessage = `${message.userMessage}`;

  const mutation = `
    mutation SendNotification($message: MessageInput!) {
      sendNotification(message: $message) {
        userId
        userMessage
      }
    }
  `;

  return executeGraphQLOperation("sendNotification", message, mutation);
};

const handleBroadcastMessage = async (message) => {
  // Ensure all required fields are present
  const requiredFields = [
    "messageId",
    "userId",
    "userName",
    "userMessage",
    "timestamp",
  ];
  for (const field of requiredFields) {
    if (!message[field]) {
      console.error(`Missing required field: ${field}`);
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return message;
};

const handleSendNotification = async (message) => {
  // Ensure all required fields are present
  const requiredFields = [
    "messageId",
    "userId",
    "userName",
    "userMessage",
    "timestamp",
    "bedrockResponse",
    "modelId",
  ];
  for (const field of requiredFields) {
    if (!message[field]) {
      console.error(`[ERROR] Missing required field: ${field}`);
      throw new Error(`[ERROR] Missing required field: ${field}`);
    }
  }

  // Return only userId and userMessage as per the Notification type
  return {
    userId: message.userId,
    userMessage: message.userMessage,
  };
};

const processMessage = async (message) => {
  let activeModel;
  try {
    activeModel = await getModelUUID();
  } catch (err) {
    console.error("[ERROR] Error fetching active model UUID from SSM:", err);
    throw err;
  }

  let promptItem;
  try {
    promptItem = await getPrompt(activeModel);
  } catch (err) {
    console.error("[ERROR] Error fetching prompt from DynamoDB:", err);
    throw err;
  }

  if (!promptItem) {
    console.error("[ERROR] Prompt not found in DynamoDB");
    throw new Error("[ERROR] Prompt not found");
  }

  const { modelId, config } = promptItem;
  const userMessage = message.message.userMessage;

  try {
    const bedrockResponse = await invokeModelWithRetry(
      modelId,
      config,
      userMessage,
      message
    );
    console.log("Bedrock response:", bedrockResponse);

    const messageData = {
      messageId: message.message.messageId,
      timestamp: message.message.timestamp,
      userId: message.message.userId,
      userName: message.message.userName,
      userMessage: message.message.userMessage,
      bedrockResponse: bedrockResponse.trim(),
      modelId: modelId,
    };
    console.log("Message Data:", messageData);

    if (bedrockResponse.trim() === "y") {
      await ddb.put({
        TableName: APPROVED_MESSAGES_TABLE,
        Item: messageData,
      });
      console.log("Message approved. Publishing to all users.");
      const broadcastResult = await broadcastMessage(messageData);
    } else if (bedrockResponse.trim() === "n") {
      await ddb.put({
        TableName: UNAPPROVED_MESSAGES_TABLE,
        Item: messageData,
      });
      console.log(
        "Message is considered harmful and it's not approved. Sending notification to user."
      );
      const notificationResult = await sendNotification(messageData);
    } else {
      await ddb.put({
        TableName: HALLUCINATIONS_TABLE,
        Item: messageData,
      });
      console.log(
        "Bedrock response is unexpected. Storing in hallucinations table."
      );
    }
  } catch (e) {
    console.error("[ERROR] Error invoking Bedrock model:", e);
    throw e;
  }
};

// Function to send metric data to CloudWatch
const sendMetricToCloudWatch = async (metricName, metricValue) => {
  const params = {
    MetricData: [
      {
        MetricName: metricName,
        Dimensions: [
          {
            Name: "ApplicationName",
            Value: "ChatModeration",
          },
        ],
        Unit: "Count",
        Value: metricValue,
        StorageResolution: Number("1"),
        Timestamp: new Date(),
      },
    ],
    Namespace: "ChatModeration/Messages",
  };

  try {
    const data = await cloudwatch.send(new PutMetricDataCommand(params));
  } catch (err) {
    console.error("[ERROR] Error sending metric to CloudWatch:", err);
  }
};

const makeHttpRequest = (url, options, body) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      ...options,
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      port: 443,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}`));
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

export const handler = async (event, context) => {
  let messages = [];
  if (Array.isArray(event.Records)) {
    // Processing SQS messages
    messages = event.Records.map((record) => JSON.parse(record.body));
  } else if (event.info && event.info.fieldName === "broadcastMessage") {
    // Direct AppSync invocation for broadcasting
    return await handleBroadcastMessage(event.arguments.message);
  } else if (event.info && event.info.fieldName === "sendNotification") {
    // Direct AppSync invocation for notification
    return await handleSendNotification(event.arguments.message);
  } else {
    // Direct invocation (not from SQS or AppSync)
    messages = [event];
  }

  try {
    // Process messages in parallel
    await Promise.all(
      messages.map(async (message) => {
        try {
          await processMessage(message);
        } catch (error) {
          console.error("[ERROR] Error processing message:", error);
          // Send to DLQ if processing fails
          await sendToDLQ(message);
        }
      })
    );
  } catch (error) {
    console.error("[ERROR] Error processing batch:", error);
  }

  return { statusCode: 200 };
};
