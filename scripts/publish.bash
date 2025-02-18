#!/bin/bash

# Store the path to the cdk-outputs.json file
CDK_OUTPUTS_FILE="../backend/cdk/cdk-outputs.json"
  
# Get the stack name from the cdk-outputs.json file
STACK_NAME=$(jq -r 'keys[0]' "$CDK_OUTPUTS_FILE")

# Extract and export the necessary values
REST_API_ENDPOINT=$(jq -r '.'"$STACK_NAME"'.RestApiEndpoint' "$CDK_OUTPUTS_FILE")
GRAPHQL_API_ENDPOINT=$(jq -r '.'"$STACK_NAME"'.GraphQlApiEndpoint' "$CDK_OUTPUTS_FILE")
APPSYNC_API_KEY=$(jq -r '.'"$STACK_NAME"'.AppSyncApiKey' "$CDK_OUTPUTS_FILE")
S3_BUCKET_STATIC_ASSETS_NAME=$(jq -r '.'"$STACK_NAME"'.S3BucketStaticAssetsName' "$CDK_OUTPUTS_FILE")
CLOUDFRONT_DISTRIBUTION_ID=$(jq -r '.'"$STACK_NAME"'.CloudFrontDistributionId' "$CDK_OUTPUTS_FILE")
CLOUDFRONT_DISTRIBUTION_DOMAIN=$(jq -r '.'"$STACK_NAME"'.CloudFrontDistributionDomain' "$CDK_OUTPUTS_FILE")

# Replace the AppSync API domain with the real-time domain
GRAPHQL_REAL_TIME_API_ENDPOINT=$(echo "$GRAPHQL_API_ENDPOINT" | sed 's/appsync-api/appsync-realtime-api/')

# Color variables
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

REACT_PROJECT_DIR="../frontend"

# Function to check the last command's status
check_status() {
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}[ERROR] Error: $1 failed${NC}"
        exit 1
    fi
}

echo -e "\n${BLUE}[INFO] Publishing Front-End Environment...${NC}"

cd "$REACT_PROJECT_DIR" > /dev/null

# Update config.js with REST and AppSync APIs
echo -e "\n${BLUE}[INFO] Exporting Endpoint Names for Front-End usage...${NC}"
cat << EOF > ./src/config/config.js
export const REST_API_ENDPOINT = "${REST_API_ENDPOINT}";
export const GRAPHQL_API_ENDPOINT = "${GRAPHQL_API_ENDPOINT}";
export const GRAPHQL_REAL_TIME_API_ENDPOINT = "${GRAPHQL_REAL_TIME_API_ENDPOINT}";
export const APPSYNC_API_KEY = "${APPSYNC_API_KEY}";
EOF
check_status "Update config.js"

# Install dependencies
echo -e "\n${BLUE}[INFO] Installing dependencies...${NC}"
npm install
check_status "Install dependencies"

# Run the build command
echo -e "\n${BLUE}[INFO] Building React project...${NC}"
npm run build
check_status "React build"

# Sync the build files with the S3 bucket
echo -e "\n${BLUE}[INFO] Syncing build files with S3 bucket...${NC}"
aws s3 sync build/ "s3://${S3_BUCKET_STATIC_ASSETS_NAME}" --delete
check_status "S3 sync"

cd - > /dev/null

# Update Locust configuration file for testing
echo -e "\n${BLUE}[INFO] Updating Locust configuration file for testing...${NC}"
cat << EOF > ../tests/locust/locust.conf
locustfile = locust_test.py
host = "${REST_API_ENDPOINT%%/messages}"
users = 100
spawn-rate = 10
run-time = 2m
EOF
check_status "Update Locust"

# Create a CloudFront invalidation
echo -e "\n${BLUE}[INFO] Creating CloudFront invalidation...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" --output text --query 'Invalidation.Id')
check_status "CloudFront invalidation creation"
echo -e "\n${GREEN}[SUCCESS] Invalidation created with ID: $INVALIDATION_ID${NC}"

# Wait for the invalidation to complete
echo -e "\n${YELLOW}[WARNING] Waiting for invalidation to complete...${NC}"
aws cloudfront wait invalidation-completed --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --id "$INVALIDATION_ID"
check_status "CloudFront invalidation completion"

echo -e "\n${GREEN}[SUCCESS] Front-End Environment published successfully.${NC}"
echo -e "\n${BLUE}[INFO] CloudFront Distribution Domain: https://${CLOUDFRONT_DISTRIBUTION_DOMAIN}${NC}"
