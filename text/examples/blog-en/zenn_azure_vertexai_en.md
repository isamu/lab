---
title: "Using Azure OpenAI / Vertex AI with MulmoCast"
emoji: "🎬"
type: "tech"
topics: ["mulmocast", "azure", "vertexai", "openai", "gcp"]
published: true
publication_name: "singularity"
---

# Using Azure OpenAI / Vertex AI with MulmoCast

MulmoCast supports enterprise-grade **Azure OpenAI** and **Google Vertex AI**.

This article explains what to configure in MulmoCast, assuming your cloud setup is already complete.

## How to Switch Providers

| Provider | How to Switch |
|----------|---------------|
| Azure OpenAI | Set BASE_URL in **environment variables** |
| Vertex AI | Add `vertexai_project` in **MulmoScript** |

---

# Azure OpenAI

## Key Point

Switching to Azure OpenAI is done **entirely through environment variables**. Your MulmoScript remains identical to OpenAI API usage.

## Environment Variables

Set `*_OPENAI_BASE_URL` in your `.env` file to route that feature to Azure OpenAI.

```bash
# Switch image generation to Azure
IMAGE_OPENAI_API_KEY=<Azure API Key>
IMAGE_OPENAI_BASE_URL=https://<resource-name>.openai.azure.com/

# Switch TTS to Azure
TTS_OPENAI_API_KEY=<Azure API Key>
TTS_OPENAI_BASE_URL=https://<resource-name>.openai.azure.com/

# Switch LLM (translate, scripting) to Azure
LLM_OPENAI_API_KEY=<Azure API Key>
LLM_OPENAI_BASE_URL=https://<resource-name>.openai.azure.com/
```

**Important**: Setting `BASE_URL` enables Azure mode. Without it, the standard OpenAI API is used.

## MulmoScript

Same as OpenAI API. No changes required.

```json
{
  "imageParams": {
    "provider": "openai",
    "model": "gpt-image-1.5"
  },
  "speechParams": {
    "speakers": {
      "Presenter": {
        "provider": "openai",
        "voiceId": "alloy",
        "model": "tts"
      }
    }
  }
}
```

## CLI Execution

Just run as usual. Azure is used automatically based on environment variables.

```bash
mulmo movie script.json
mulmo audio script.json
mulmo images script.json
mulmo translate script.json -l ja
```

## Important Notes

### Deployment Name = Model Name

In Azure, deployment names must exactly match model names. MulmoCast uses the `model` parameter directly as the deployment name.

```bash
# OK: deployment name is gpt-image-1.5
--deployment-name "gpt-image-1.5"

# NG: replaced with hyphens
--deployment-name "gpt-image-1-5"
```

### Region Selection

For both image generation and TTS, **Sweden Central** is recommended (supports both).

| Region | Image Generation | TTS |
|--------|-----------------|-----|
| Sweden Central | ✅ | ✅ |
| East US 2 | ✅ | ❌ |
| North Central US | ❌ | ✅ |

---

# Google Vertex AI

## Key Point

Switching to Vertex AI is done by adding `vertexai_project` **in MulmoScript**.

## Prerequisites

ADC (Application Default Credentials) must be configured.

```bash
gcloud auth application-default login
```

## MulmoScript Configuration

Adding `vertexai_project` to `imageParams` or `movieParams` enables Vertex AI mode.

```json
{
  "imageParams": {
    "provider": "google",
    "model": "imagen-4.0-generate-001",
    "vertexai_project": "your-project-id",
    "vertexai_location": "us-central1"
  }
}
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `vertexai_project` | GCP Project ID | None (enables Vertex AI mode when set) |
| `vertexai_location` | Region | `us-central1` |

## Video Generation (Veo)

```json
{
  "movieParams": {
    "provider": "google",
    "model": "veo-2.0-generate-001",
    "vertexai_project": "your-project-id",
    "vertexai_location": "us-central1"
  }
}
```

## CLI Execution

```bash
mulmo images script.json
mulmo movie script.json
```

## Difference from Gemini API

| Aspect | Gemini API | Vertex AI |
|--------|-----------|-----------|
| Authentication | `GEMINI_API_KEY` env var | ADC |
| MulmoScript | No `vertexai_project` | Has `vertexai_project` |

For Gemini API:

```bash
# Environment variable
GEMINI_API_KEY=your_api_key
```

```json
{
  "imageParams": {
    "provider": "google",
    "model": "gemini-2.5-flash-image"
  }
}
```

For Vertex AI, just add `vertexai_project`:

```json
{
  "imageParams": {
    "provider": "google",
    "model": "imagen-4.0-generate-001",
    "vertexai_project": "your-project-id"
  }
}
```

## Available Models

**Image Generation**:
- `imagen-4.0-generate-001` (standard)
- `imagen-4.0-ultra-generate-001` (high quality)
- `imagen-4.0-fast-generate-001` (fast)

**Video Generation**:
- `veo-2.0-generate-001`
- `veo-3.0-generate-001`
- `veo-3.1-generate-preview`

---

# Summary

| Provider | Configuration Location | What to Set |
|----------|----------------------|-------------|
| Azure OpenAI | Environment variables | Set `*_OPENAI_BASE_URL` |
| Vertex AI | MulmoScript | Add `vertexai_project` |

```bash
# Azure: Switch via environment variable
IMAGE_OPENAI_BASE_URL=https://xxx.openai.azure.com/

# Vertex AI: Specify in MulmoScript
"vertexai_project": "my-project-id"
```

---

# Appendix: Cloud Setup

## Azure OpenAI Setup

### 1. Install Azure CLI and Login

```bash
# macOS
brew install azure-cli

# Login
az login
```

### 2. Create Resources

```bash
# Create resource group
az group create --name my-rg --location swedencentral

# Create Azure OpenAI resource
az cognitiveservices account create \
  --name my-openai-resource \
  --resource-group my-rg \
  --kind OpenAI \
  --sku S0 \
  --location swedencentral \
  --yes

# Set custom domain (required)
az cognitiveservices account update \
  --name my-openai-resource \
  --resource-group my-rg \
  --custom-domain my-openai-resource
```

### 3. Deploy Models

```bash
# Image generation model
az cognitiveservices account deployment create \
  --name my-openai-resource \
  --resource-group my-rg \
  --deployment-name "gpt-image-1.5" \
  --model-name gpt-image-1.5 \
  --model-version "2025-12-16" \
  --model-format OpenAI \
  --sku-capacity 1 \
  --sku-name GlobalStandard

# TTS model
az cognitiveservices account deployment create \
  --name my-openai-resource \
  --resource-group my-rg \
  --deployment-name "tts" \
  --model-name tts \
  --model-version "001" \
  --model-format OpenAI \
  --sku-capacity 1 \
  --sku-name Standard

# LLM model
az cognitiveservices account deployment create \
  --name my-openai-resource \
  --resource-group my-rg \
  --deployment-name "gpt-4o" \
  --model-name gpt-4o \
  --model-version "2024-11-20" \
  --model-format OpenAI \
  --sku-capacity 1 \
  --sku-name Standard
```

### 4. Get API Key

```bash
# API Key
az cognitiveservices account keys list \
  --name my-openai-resource \
  --resource-group my-rg \
  --query "key1" -o tsv

# Verify endpoint
az cognitiveservices account show \
  --name my-openai-resource \
  --resource-group my-rg \
  --query "properties.endpoint" -o tsv
```

### 5. List Available Models

```bash
# Image generation models
az cognitiveservices model list --location swedencentral -o json | \
  jq '[.[] | .model | {name, version}] | unique_by(.name) | .[] | select(.name | test("gpt-image|dall"; "i"))'

# TTS models
az cognitiveservices model list --location swedencentral -o json | \
  jq '[.[] | .model | {name, version}] | unique_by(.name) | .[] | select(.name | test("tts"; "i"))'
```

---

## Google Vertex AI Setup

### 1. Install gcloud CLI and Login

```bash
# macOS
brew install google-cloud-sdk

# Login
gcloud auth login

# List projects
gcloud projects list

# Set project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs

```bash
# Vertex AI API
gcloud services enable aiplatform.googleapis.com

# Generative AI API
gcloud services enable generativelanguage.googleapis.com
```

### 3. Configure ADC

```bash
# Set up Application Default Credentials (opens browser)
gcloud auth application-default login

# Verify
gcloud auth application-default print-access-token
```

### 4. Grant IAM Permissions (if needed)

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/aiplatform.user"
```

### 5. Available Regions

Vertex AI is available in the following regions:

- `us-central1` (recommended)
- `us-east1`
- `us-west1`
- `europe-west1`
- `asia-northeast1` (Tokyo)
