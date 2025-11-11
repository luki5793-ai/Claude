# Deployment Guide

This guide explains how to deploy the Google Jobs IT Scraper to Apify Platform.

## Prerequisites

1. **Apify Account**: Sign up at [https://apify.com](https://apify.com)
2. **Apify CLI** (optional): Install with `npm install -g apify-cli`

## Method 1: Deploy via Apify Console (Recommended)

### Step 1: Create a New Actor

1. Log in to [Apify Console](https://console.apify.com)
2. Navigate to **Actors** → **Create new**
3. Choose **Empty actor** template
4. Enter actor name: `google-jobs-it-scraper`

### Step 2: Upload Source Code

1. In the actor editor, select **Source** tab
2. Copy all files from this repository:
   - `package.json`
   - `tsconfig.json`
   - `.actor/actor.json`
   - `.actor/input_schema.json`
   - `src/main.ts`
   - `src/types.ts`
   - `src/utils.ts`
   - `src/scraper.ts`
   - `Dockerfile`
   - `README.md`
   - `.actorignore`

3. Ensure the file structure matches:
```
/
├── .actor/
│   ├── actor.json
│   └── input_schema.json
├── src/
│   ├── main.ts
│   ├── types.ts
│   ├── utils.ts
│   └── scraper.ts
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
└── .actorignore
```

### Step 3: Build the Actor

1. Click **Build** button (or press **Ctrl+B**)
2. Wait for build to complete (usually 2-5 minutes)
3. Check build logs for any errors

### Step 4: Test the Actor

1. Go to **Input** tab
2. Enter test input:
```json
{
  "searchQueries": ["Software Developer"],
  "locations": ["Berlin"],
  "maxResults": 10
}
```
3. Click **Save & Run**
4. Monitor the run logs
5. Check results in **Dataset** tab

### Step 5: Publish (Optional)

1. Go to **Publication** tab
2. Fill in actor details:
   - Title: "Google Jobs IT Scraper (Germany)"
   - Description: From README.md
   - Categories: Web Scraping, Job Boards
3. Click **Publish to Apify Store**

## Method 2: Deploy via Apify CLI

### Step 1: Install Apify CLI

```bash
npm install -g apify-cli
```

### Step 2: Login to Apify

```bash
apify login
```

Enter your Apify API token when prompted.

### Step 3: Initialize Project (if needed)

```bash
# Only if you haven't cloned the repository
apify create google-jobs-scraper
cd google-jobs-scraper
```

### Step 4: Deploy

```bash
# Push to Apify
apify push

# Or push with build
apify push --build-tag latest
```

### Step 5: Run

```bash
# Run the actor
apify run

# Or run with specific input
apify run --input-file .actor/INPUT.json
```

## Method 3: Deploy via GitHub Integration

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Connect to Apify

1. In Apify Console, create new actor
2. Go to **Source** tab
3. Select **Git repository**
4. Connect your GitHub account
5. Select repository
6. Set build configuration:
   - Branch: `main`
   - Dockerfile: `./Dockerfile`

### Step 3: Auto-deploy

- Enable **Auto-build on push**
- Every push to main branch will trigger a new build

## Configuration Options

### Proxy Configuration

For production use, configure Apify Proxy:

```json
{
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Memory Settings

Recommended memory allocation:
- **Development/Testing**: 512 MB
- **Production**: 1024 MB - 2048 MB

Set in actor settings under **Resources**.

### Timeout Settings

Recommended timeout:
- **Small runs** (<50 queries): 15 minutes
- **Medium runs** (50-200 queries): 30 minutes
- **Large runs** (>200 queries): 60 minutes

Set in actor settings under **Limits**.

## Monitoring & Maintenance

### Check Actor Runs

```bash
# List recent runs
apify runs ls

# Get run details
apify run info <run-id>

# Download dataset
apify dataset download <dataset-id>
```

### View Logs

1. Go to **Runs** tab in Apify Console
2. Click on a run
3. View **Log** tab for detailed logs

### Update Actor

#### Via Console:
1. Edit files in **Source** tab
2. Click **Build**
3. Test and publish

#### Via CLI:
```bash
# Make changes locally
# Then push
apify push

# Or with version tag
apify push --version-number 1.0.1
```

## Troubleshooting

### Build Fails

**Issue**: TypeScript compilation errors

**Solution**:
```bash
# Test build locally first
npm run build

# Fix any TypeScript errors
# Then push again
```

### Runtime Errors

**Issue**: Actor crashes during run

**Solution**:
1. Check logs for error messages
2. Verify input format matches schema
3. Increase memory allocation
4. Enable proxy if getting blocked

### No Results

**Issue**: Actor runs but returns empty dataset

**Solution**:
1. Test search queries manually on Google Jobs
2. Check if locations are valid
3. Review excluded words - might be filtering too much
4. Check logs for parsing errors

## Production Best Practices

1. **Always use proxies** for production runs
2. **Set appropriate delays** (2-5 seconds between requests)
3. **Monitor costs** - check Apify usage dashboard
4. **Version your actor** - use semantic versioning
5. **Test before scaling** - start with small runs
6. **Set up alerts** - configure notifications for failures
7. **Backup results** - regularly export datasets

## Scheduling Runs

### Via Apify Console:

1. Go to **Schedules** tab
2. Click **Create new schedule**
3. Configure:
   - Name: "Daily IT Jobs Scrape"
   - Cron: `0 9 * * *` (daily at 9 AM)
   - Input: Your configuration
4. Save schedule

### Via API:

```bash
curl -X POST https://api.apify.com/v2/acts/<actor-id>/runs \
  -H "Authorization: Bearer <api-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "searchQueries": ["Software Developer"],
    "locations": ["Berlin"]
  }'
```

## Costs Estimation

Approximate costs per 1000 jobs scraped:

- **Compute**: $0.10 - $0.30
- **Proxy (Residential)**: $0.50 - $1.50
- **Storage**: $0.01 - $0.05

Total: **$0.61 - $1.85 per 1000 jobs**

*Prices are estimates and may vary based on Apify pricing.*

## Support

- **Apify Documentation**: [https://docs.apify.com](https://docs.apify.com)
- **Apify Discord**: [https://discord.com/invite/jyEM2PRvMU](https://discord.com/invite/jyEM2PRvMU)
- **Apify Support**: support@apify.com

---

**Ready to deploy? Follow the steps above and start scraping! 🚀**
