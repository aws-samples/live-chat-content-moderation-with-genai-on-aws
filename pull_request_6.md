# feat(bedrock): upgrade to Claude 3.5 Haiku

## Overview
This PR upgrades our chat moderation system to use Claude 3.5 Haiku (20241022-v1:0), providing enhanced content moderation capabilities.

## Changes
• Updated Bedrock model permissions in api-stack.ts to allow access to Claude 3.5 Haiku
• Updated model ID in insert-prompt.bash from anthropic.claude-3-haiku-20240307-v1:0 to anthropic.claude-3-5-haiku-20241022-v1:0

## Why
Claude 3.5 Haiku offers improved performance and capabilities compared to the previous version, enhancing our content moderation system's effectiveness.

## Testing Instructions
1. Deploy the changes:  
   ```bash
   ./scripts/install.bash
   ```
2. Verify Bedrock model access in AWS Console
3. Test content moderation with various message types:  
   • Normal messages  
   • Potentially harmful content  
   • Edge cases

## Deployment Notes
• Requires AWS Bedrock access to Claude 3.5 Haiku
• No downtime expected during deployment
• Automatic rollback available through CloudFormation

## Checklist
- [x] Updated model permissions
- [x] Updated model ID
- [x] Tested locally
- [x] Documentation updated
- [x] No breaking changes