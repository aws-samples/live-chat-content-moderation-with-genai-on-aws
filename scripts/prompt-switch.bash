#!/bin/bash

# Store the path to the cdk-outputs.json file
CDK_OUTPUTS_FILE="../backend/cdk/cdk-outputs.json"
  
# Get the stack name from the cdk-outputs.json file
STACK_NAME=$(jq -r 'keys[0]' "$CDK_OUTPUTS_FILE")

# Extract and export the necessary values
TITAN_MODEL_UUID=$(jq -r '.'"$STACK_NAME"'.TitanModelUUID' "$CDK_OUTPUTS_FILE")
HAIKU_MODEL_UUID=$(jq -r '.'"$STACK_NAME"'.HaikuModelUUID' "$CDK_OUTPUTS_FILE")
LLAMA_MODEL_UUID=$(jq -r '.'"$STACK_NAME"'.LlamaModelUUID' "$CDK_OUTPUTS_FILE")
NOVA_LITE_MODEL_UUID=$(jq -r '.'"$STACK_NAME"'.NovaLiteModelUUID' "$CDK_OUTPUTS_FILE")
NOVA_PRO_MODEL_UUID=$(jq -r '.'"$STACK_NAME"'.NovaProModelUUID' "$CDK_OUTPUTS_FILE")
PROMPT_SWITCH_PARAMETER_NAME=$(jq -r '.'"$STACK_NAME"'.PromptSwitchParameterName' "$CDK_OUTPUTS_FILE")

# Color variables
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if an argument is provided
if [ -z "$1" ]; then
  echo -e "\n${RED}[ERROR] Please provide a model name (titan, haiku, or llama) as an argument."
  exit 1
fi

# Set the NEW_ACTIVE_MODEL based on the provided argument
case "$1" in
  titan)
    NEW_ACTIVE_MODEL="$TITAN_MODEL_UUID"
    ;;
  haiku)
    NEW_ACTIVE_MODEL="$HAIKU_MODEL_UUID"
    ;;
  llama)
    NEW_ACTIVE_MODEL="$LLAMA_MODEL_UUID"
    ;;
  nova-lite)
    NEW_ACTIVE_MODEL="$NOVA_LITE_MODEL_UUID"
    ;;
  nova-pro)
    NEW_ACTIVE_MODEL="$NOVA_PRO_MODEL_UUID"
    ;;
  *)
    echo -e "\n${RED}[ERROR] Invalid model name provided. Please use titan, haiku, llama, nova-lite, or nova-pro."
    exit 1
    ;;
esac

echo -e "\n${YELLOW}[WARNING] Switching to $1 model and prompt (UUID: $NEW_ACTIVE_MODEL)..."

# Update the SSM Parameter
aws ssm put-parameter \
  --name "$PROMPT_SWITCH_PARAMETER_NAME" \
  --value "$NEW_ACTIVE_MODEL" \
  --type String \
  --overwrite

if [ $? -ne 0 ]; then
  echo -e "\n${RED}[ERROR] Failed to switch model and prompt.${NC}"
  exit 1
fi

echo -e "\n${YELLOW}[WARNING] Model and prompt switched to: $1 (UUID: $NEW_ACTIVE_MODEL)"
echo -e "\n${GREEN}[SUCCESS] Model and prompt switch completed successfully!${NC}"
