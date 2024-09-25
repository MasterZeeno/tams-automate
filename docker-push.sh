#!/bin/bash

# Variables
DOCKER_USERNAME="masterzeeno"  # Replace with your Docker Hub username
DOCKER_PASSWORD="546609529jay"  # Replace with your Docker Hub password
IMAGE_NAME="puppeteer-runner"
REMOTE_REPO="masterzeeno/puppeteer-runner:latest"

# Function to log in to Docker Hub
docker_login() {
  echo "Logging into Docker Hub..."
  echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
  if [ $? -ne 0 ]; then
    echo "Docker login failed. Check your credentials."
    exit 1
  fi
  echo "Logged in to Docker Hub successfully."
}

# Function to build the Docker image
docker_build() {
  echo "Building Docker image..."
  docker build -t "$IMAGE_NAME" .
  if [ $? -ne 0 ]; then
    echo "Docker build failed."
    exit 1
  fi
  echo "Docker image built successfully."
}

# Function to run and test the Docker image locally
docker_run_test() {
  echo "Running the Docker container to test..."
  docker run --rm "$IMAGE_NAME"
  if [ $? -ne 0 ]; then
    echo "Docker container run failed."
    exit 1
  fi
  echo "Docker container ran successfully."
}

# Function to tag the image for Docker Hub
docker_tag() {
  echo "Tagging Docker image for Docker Hub..."
  docker tag "$IMAGE_NAME" "$REMOTE_REPO"
  if [ $? -ne 0 ]; then
    echo "Docker image tagging failed."
    exit 1
  fi
  echo "Docker image tagged successfully."
}

# Function to push the Docker image to Docker Hub
docker_push() {
  echo "Pushing Docker image to Docker Hub..."
  docker push "$REMOTE_REPO"
  if [ $? -ne 0 ]; then
    echo "Docker push failed."
    exit 1
  fi
  echo "Docker image pushed to Docker Hub successfully."
}

# Main script execution
main() {
  docker_login
  # docker_build
  # docker_run_test
  docker_tag
  docker_push
}

# Run the main function
main

