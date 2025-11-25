#!/bin/bash

# Configuration
PROJECT_ID="pdf2csv-475708"
SERVICE_NAME="pdf2csv-backend"
REGION="us-central1"

echo "Setting up permissions for Cloud Run service account..."

# 1. Get the Service Account email used by Cloud Run
# Assuming the default compute service account or a specific one if configured.
# For Gen2 Cloud Run, it defaults to the Compute Engine default service account if not specified.
# We will try to fetch it from the service description.

SERVICE_ACCOUNT=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(spec.template.spec.serviceAccountName)")

if [ -z "$SERVICE_ACCOUNT" ]; then
  echo "Could not determine service account for $SERVICE_NAME. Using default compute service account."
  PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
  SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "Service Account: $SERVICE_ACCOUNT"

# 2. Grant Cloud SQL Admin permissions (to start/stop instances)
echo "Granting Cloud SQL Editor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.editor"

# 3. Grant Document AI Admin permissions (to deploy/undeploy processors)
echo "Granting Document AI Editor role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/documentai.editor"

echo "Permissions granted successfully!"
echo "You can now use the Resource Management Dashboard in your application."
