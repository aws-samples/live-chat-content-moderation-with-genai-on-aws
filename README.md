# Live Chat Content Moderation with generative AI on AWS

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [Running the Application](#running-the-application)
  - [Switching Prompts/Models](#switching-promptsmodels)
  - [Updating the Front-End](#updating-the-front-end)
  - [Moderation Guidelines](#moderation-guidelines)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Performance and Scalability](#performance-and-scalability)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Overview

The **Live Chat Content Moderation with generative AI on AWS** project is a scalable, multilingual, real-time chat moderation system designed for live chat platforms. It leverages AWS services and generative AI to automatically filter and moderate chat messages, ensuring a safe and engaging environment for users.

## Architecture

This solution utilizes several AWS services to create a robust and scalable architecture:

- **Amazon API Gateway**: Handles incoming WebSocket connections and REST API requests;
- **AWS Lambda**: Processes messages and interacts with other services;
- **Amazon DynamoDB**: Stores chat messages, approved messages, and moderation prompts;
- **Amazon SQS**: Manages message queues for reliable processing;
- **AWS AppSync**: Facilitates real-time updates using GraphQL subscriptions;
- **Amazon Bedrock**: Provides generative AI capabilities for message moderation;
- **Amazon CloudFront & S3**: Hosts and serves the front-end application;
- **AWS WAF**: Protects your web applications from common exploits;
- **AWS CDK**: Defines and deploys the infrastructure as code.

### System Architecture Diagram

![System Architecture Diagram](live-chat-moderation-gen-ai-architecture-diagram.png)

## Features

- Real-time chat moderation using generative AI;
- Scalable WebSocket connections for live chat;
- Multiple AI model support with easy switching;
- Front-end React application for chat interface;
- Comprehensive observability and monitoring;
- Secure and compliant with AWS best practices.

### Cost

The solution utilizes several AWS services, each contributing to the overall cost. Key services include:

1. Amazon API Gateway: Charges based on the number of API calls and data transfer;
2. AWS Lambda: Costs depend on the number of requests, duration, and memory allocated;
3. Amazon DynamoDB: Pricing based on read/write capacity units or on-demand pricing;
4. Amazon SQS: Charges per million requests;
5. AWS AppSync: Costs based on the number of API requests and real-time updates;
6. Amazon Bedrock: Pricing varies by model and is based on the number of input and output tokens;
7. Amazon CloudFront: Charges for data transfer and number of requests;
8. AWS WAF: Charges on the number of web ACLs, number of rules per web ACL, and number of web requests;
9. Amazon CloudWatch: Costs for log ingestion, storage, and dashboard usage;
10. AWS Systems Manager Parameter Store: Standard parameters are free, advanced parameters have a nominal cost.

Here is an example of a monthly cost estimate based on 1,000 users, 1,000,000 messages sent and 200,000,000 token usage based on N. Virginia (us-east-1):

| AWS service                        | Dimensions                                                                     | Cost [USD] |
| ---------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| Amazon CloudFront                  | 1,000 users requesting 64 MBs of Static Assets                                 | $7.84      |
| AWS WAF                            | 2 Web ACLs + 2 Rules + 1,000,000 of requests                                   | $13.20     |
| Amazon Simple Storage Service (S3) | 16 MBs of Static Assets                                                        | $4.03      |
| Amazon API Gateway                 | 1,000,000 REST API Requests                                                    | $3.50      |
| Amazon Simple Queue Service (SQS)  | 1,000,000 Messages                                                             | $0.01      |
| AWS Lambda                         | 1,000,000 of Lambda Executions with 256 MBs of RAM and 2000ms average duration | $8.53      |
| AWS AppSync                        | 1,000,000 of API requests and 1,000 of connected clients with 1 hour duration  | $10.29     |
| Amazon Bedrock                     | 200,000,000 of input + output tokens                                           | $30.20     |
| Amazon Bedrock Guardrails          | 5,000 text units (1,000,000 messages with 200 characters average)              | $3.75      |
| AWS Systems Manager                | 1 SSM Query per minute                                                         | $0.01      |
| Amazon DynamoDB                    | Reads from Prompt Store and 1,000,000 Writes to Messages Tables                | $2.27      |
| Amazon CloudWatch                  | 34 Metrics, 1 Dashboard, 1 GB of Logs                                          | $11.21     |
| AWS X-Ray                          | 20% sample of 1,000,000 messages                                               | $1.20      |

For a more accurate cost estimate, use the AWS Pricing Calculator and input your expected usage patterns.

### Supported AI Models

The system supports three different AI models for chat moderation:

1. **Anthropic Claude Haiku**: Claude 3 Haiku is Anthropic's fastest, most compact model for near-instant responsiveness. It answers simple queries and requests with speed. Customers will be able to build seamless AI experiences that mimic human interactions. Claude 3 Haiku can process images and return text outputs, and features a 200K context window.

2. **Amazon Titan**: Amazon Titan Text Premier is an advanced, high-performance, and cost-effective LLM engineered to deliver superior performance for enterprise-grade text generation applications, including optimized performance for retrieval-augmented generation (RAG) and Agents.

3. **Meta Llama**: Meta Llama 3 is an accessible, open large language model (LLM) designed for developers, researchers, and businesses to build, experiment, and responsibly scale their generative AI ideas. Part of a foundational system, it serves as a bedrock for innovation in the global community. Ideal for limited computational power and resources, edge devices, and faster training times.

Each model has its own strengths and characteristics. You can switch between these models using the `prompt-switch.bash` script.

## Prerequisites

- AWS Account;
- AWS CLI configured with your credentials with permissions configured;
- Node.js (version 20.x or later);
- Appropriate permissions to install npm packages in your system;
- Git;
- [jq](https://jqlang.github.io/jq/download/).

## Deployment

1. Clone the repository:

   ```
   git clone https://github.com/aws-samples/live-chat-content-moderation-with-genai-on-aws.git
   ```

2. Navigate to the project directory:

   ```
   cd live-chat-content-moderation-with-genai-on-aws/scripts
   ```

3. Run the installation script:
   ```
   ./install.bash
   ```

This script will set up the necessary AWS resources, deploy the back-end infrastructure, and prepare the front-end application.

## Deployment Validation

After running the installation script (`./install.bash`), follow these steps to validate the successful deployment of your Live Chat Moderation system:

1. Open the AWS CloudFormation console and verify the status of the stack named "ChatModeration". It should be in the "CREATE_COMPLETE" state.

2. Check the outputs of the CloudFormation stack for the following key resources:

   - REST API Endpoint
   - GraphQL API Endpoint
   - CloudFront Distribution Domain

3. Verify the creation of DynamoDB tables:

   ```
   aws dynamodb list-tables --query "TableNames[?contains(@, 'ChatModeration')]"
   ```

You should see four tables: ApprovedMessagesTable, UnapprovedMessagesTable, HallucinationsTable, and PromptStoreTable.

4. Confirm the Lambda function deployment:

   ```
   aws lambda get-function --function-name ChatModeration-MessageProcessorFunction
   ```

This should return details about the deployed function.

5. Verify the SQS queues:

   ```
   aws sqs list-queues --queue-name-prefix ChatModeration
   ```

You should see two queues: MessageQueue.fifo and DeadLetterQueue.fifo.

6. Check the AppSync API:

   ```
   aws appsync list-graphql-apis --query "graphqlApis[?name=='ChatModeration-GraphQLApi']"
   ```

This should return details about your GraphQL API.

7. Verify the CloudFront distribution:

   ```
   aws cloudfront list-distributions --query "DistributionList.Items"
   ```

You should see details of your CloudFront distribution.

If all these resources are present and correctly configured, your deployment has been successful.

## Usage

## Running the Solution

After installation, the application should be accessible via the CloudFront URL provided in the output. To test and use the Live Chat Moderation system:

1. Open a web browser and navigate to the CloudFront Distribution Domain provided in `./install.bash` output or the CloudFormation stack outputs.

2. You should see the chat interface. Try sending various types of messages:

- A normal, non-offensive message: "Hello, how is everyone doing today?"
- A message containing mild profanity: "This stream is damn good!"
- A message with hate speech or discrimination: "I hate people from [specific country]"

3. Observe the behavior:

- Normal messages should appear in the chat;
- Mildly offensive messages may or may not be blocked, depending on the AI model's judgment;
- Hate speech or discriminatory messages should be blocked, and you should receive a notification.

4. To test the real-time nature of the chat, open the application in two different browser windows and send messages from both. You should see messages appear in real-time on both screens.

5. To verify the multilingual support, try sending messages in different languages.

Expected Output:

- Approved messages appear in the chat interface;
- Blocked messages trigger a notification to the user;
- The chat updates in real-time across multiple browser windows.

### Switching Prompts/Models

To switch between different AI models or prompts:

```
./prompt-switch.bash <model-name>
```

Replace `<model-name>` with one of the available options: `titan`, `haiku`, or `llama`. The aforementioned `./install.bash` script configures Anthropic Claude Haiku to be used by default.

### Updating the Front-End

After making changes to the front-end code, deploy updates using:

```
./publish.bash
```

This script will build the React application and update the S3 bucket and CloudFront distribution. This is not required at the first deployment.

### Moderation Guidelines

The AI models use the following prompt as the main guideline for moderating chat messages:

```
Instructions:
You are a moderation bot tasked with identifying and preventing the spread of harmful, aggressive, racist, or toxic messages in a live stream chat. Analyze the context and intent of the message, not just specific words. Respond only with y for safe messages or n for harmful messages. Do not provide any explanation.
Consider these guidelines when evaluating:
1. Hate speech or discrimination
2. Explicit threats of violence
3. Severe profanity
4. Bullying or harassment
5. Spam or excessive self-promotion
6. Selling or advertising products
7. Sharing personal information
8. Encouraging self-harm or illegal activities
If a message is ambiguous, err on the side of caution and allow it.
Your entire response MUST be either y or n, nothing else.
```

This prompt instructs the AI to evaluate messages based on various criteria and respond with a simple 'y' for safe messages or 'n' for harmful ones.

## Monitoring and Observability

The project includes a CloudWatch dashboard for monitoring key metrics:

- Bedrock model invocations and latency;
- SQS queue metrics;
- Lambda function metrics;
- API Gateway request counts.

Access the dashboard in the CloudWatch console under "ChatModeration-Monitoring".

## Performance and Scalability

The Live Chat Moderation with Generative AI system is built on AWS services, which provide high scalability and performance. However, it's important to be aware of AWS service quotas and limits that may affect the system's scalability:

1. **API Gateway**: Limits on the number of WebSocket connections and API requests per second;
2. **Lambda**: Concurrent execution limits and individual function timeout limits;
3. **DynamoDB**: Read and write capacity units, which affect the rate of database operations;
4. **SQS**: Message throughput and retention limits;
5. **Bedrock**: API call rate limits and token limits for AI model invocations.

To test the system's performance and identify potential bottlenecks, you can use Locust for load testing. The project includes a Locust configuration file located at `../tests/locust/locust.conf`. This file is automatically updated with the correct API endpoint when you run the `publish.bash` script.

To use Locust:

1. Install Locust:

   ```
   pip install locust
   ```

2. Navigate to the Locust test directory:

   ```
   cd ../tests/locust
   ```

3. Run Locust:

   ```
   locust
   ```

4. Open a web browser and go to `http://localhost:8089` to access the Locust web interface.

5. Enter the number of users to simulate, spawn rate, and other test parameters.

6. Start the test and monitor the results to identify performance bottlenecks or scalability issues.

Remember to monitor your AWS usage and adjust service limits if needed as your chat moderation system scales.

## Security Considerations

- DynamoDB tables use encryption at rest
- Lambda functions use least-privilege IAM roles
- S3 bucket for static assets is not publicly accessible
- CloudFront distribution uses HTTPS

## Cleanup

To delete all resources associated with the Live Chat Moderation system:

1. Destroy the CDK stack:

   ```
   cdk destroy
   ```

## Next Steps

To further enhance your Live Chat Moderation system:

1. Customize AI Prompts: Modify the prompts in the `insert-prompt.bash <model-name>` scripts to fine-tune the moderation criteria for your specific use case.

2. Implement User Authentication: Add user authentication to associate messages with verified user accounts.

## Notices

_Customers are responsible for making their own independent assessment of the information in this Guidance. This Guidance: (a) is for informational purposes only, (b) represents AWS current product offerings and practices, which are subject to change without notice, and (c) does not create any commitments or assurances from AWS and its affiliates, suppliers or licensors. AWS products or services are provided “as is” without warranties, representations, or conditions of any kind, whether express or implied. AWS responsibilities and liabilities to its customers are controlled by AWS agreements, and this Guidance is not part of, nor does it modify, any agreement between AWS and its customers._

## Authors

- Gabriel Costa
- Juliano Baeta
