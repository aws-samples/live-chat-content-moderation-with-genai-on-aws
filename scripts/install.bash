#!/bin/bash

# Color variables
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Version requirements
NODE_VERSION_REQ="20.0.0"
NPM_VERSION_REQ="10.8.2"
CDK_VERSION_REQ="2.158.0"

# Function to compare versions
version_compare() {
    if [[ $1 == $2 ]]
    then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++))
    do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++))
    do
        if [[ -z ${ver2[i]} ]]
        then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]}))
        then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]}))
        then
            return 2
        fi
    done
    return 0
}

# Function to check version
check_version() {
    local command=$1
    local version_req=$2
    local version_current

    if ! command -v $command &> /dev/null; then
        echo -e "\n${RED}[ERROR] $command is not installed. Please install it and try again.${NC}"
        exit 1
    fi

    if [[ $command == "node" ]]; then
        version_current=$(node -v | cut -d 'v' -f 2)
    elif [[ $command == "npm" ]]; then
        version_current=$(npm -v)
    elif [[ $command == "cdk" ]]; then
        version_current=$(cdk --version | awk '{print $1}')
    else
        echo -e "\n${RED}[ERROR] Unknown command: $command${NC}"
        exit 1
    fi

    version_compare $version_current $version_req
    case $? in
        0) echo -e "\n${GREEN}[SUCCESS] $command version $version_current is installed.${NC}" ;;
        1) echo -e "\n${GREEN}[SUCCESS] $command version $version_current is installed (newer than required $version_req).${NC}" ;;
        2) echo -e "\n${RED}[ERROR] $command version $version_current is older than the required version $version_req. Please update and try again.${NC}"
           exit 1 ;;
    esac
}

check_dependencies() {
    echo -e "\n${BLUE}[INFO] Checking dependencies...${NC}"
    
    check_version "node" $NODE_VERSION_REQ
    check_version "npm" $NPM_VERSION_REQ
    check_version "cdk" $CDK_VERSION_REQ
    
    # Check if AWS CLI is installed
    if command -v aws &> /dev/null; then
        echo -e "\n${GREEN}[SUCCESS] AWS CLI is installed.${NC}"
    else
        echo -e "\n${RED}[ERROR] AWS CLI is not installed. Please install it and try again.${NC}"
        exit 1
    fi
    
    # Check if jq is installed
    if command -v jq &> /dev/null; then
        echo -e "\n${GREEN}[SUCCESS] jq is installed.${NC}"
    else
        echo -e "\n${RED}[ERROR] jq is not installed. Please install it and try again.${NC}"
        exit 1
    fi
    
    echo -e "\n${GREEN}[SUCCESS] All dependencies are installed and meet the version requirements!${NC}"
}

deploy_cdk_stack() {
    echo -e "\n${BLUE}[INFO] Deploying CDK Stack...${NC}"
    
    # Store the path to the CDK directory
    CDK_DIR="../backend/cdk"
    
    # Change to the CDK directory
    cd "$CDK_DIR" > /dev/null || { echo -e "\n${RED}[ERROR] Failed to change to CDK directory. Aborting.${NC}"; exit 1; }
    
    # Install and update AWS CDK
    echo -e "\n${BLUE}[INFO] Installing and Updating CDK...${NC}"
    npm install || { echo -e "\n${RED}[ERROR] Failed to install npm packages. Aborting.${NC}"; exit 1; }
    npm install -g esbuild || { echo -e "\n${RED}[ERROR] Failed to install esbuild. Aborting.${NC}"; exit 1; }
    npm install -g aws-cdk --force || { echo -e "\n${RED}[ERROR] Failed to install aws-cdk globally. Aborting.${NC}"; exit 1; }
    
    # Define the CDK Outputs file
    CDK_OUTPUTS_FILE="cdk-outputs.json"
    
    echo -e "\n${BLUE}[INFO] CDK Output:${NC}"
    # Run 'cdk deploy' command
    cdk deploy --all --require-approval never --outputs-file "$CDK_OUTPUTS_FILE"
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}[ERROR] CDK deployment failed. Aborting.${NC}"
        exit 1
    fi
    echo -e "\n${BLUE}[INFO] End of CDK Output.${NC}"
    
    # Change back to the original directory
    cd - > /dev/null || { echo -e "\n${RED}[ERROR] Failed to change back to original directory. Aborting.${NC}"; exit 1; }
}

run_script() {
    echo -e "\n${BLUE}[INFO] Running script: $1${NC}"
    "$@"
    if [ $? -ne 0 ]; then
        echo -e "\n${RED}[ERROR] Script $1 failed. Aborting.${NC}"
        exit 1
    fi
}

update_and_run_scripts() {
    echo -e "\n${BLUE}[INFO] Running scripts...${NC}"
    
    run_script ./insert-prompt.bash titan
    
    run_script ./insert-prompt.bash haiku

    run_script ./insert-prompt.bash haiku-3.5
    
    run_script ./insert-prompt.bash llama

    run_script ./insert-prompt.bash nova-micro

    run_script ./prompt-switch.bash haiku
    
    run_script ./publish.bash
    
    echo -e "\n${GREEN}[SUCCESS] All scripts executed successfully!${NC}"
}

# Main script
main() {
    echo -e "\n${BLUE}[INFO] Starting the deployment process...${NC}"
    check_dependencies
    deploy_cdk_stack
    update_and_run_scripts
    echo -e "\n${GREEN}[SUCCESS] Deployment completed successfully!${NC}"
}

# Run the main script
main