# Pokemon Decklist Detector
Deployed at [decklist.debkbanerji.com](https://decklist.debkbanerji.com)

## Useful Commands

```
# Data fetching
# From 'data_fetcher'
pip install -r requirements.txt
python fetch_data.py
```
```
# Running/building the UI, after the data has been fetched
# From 'client'
npm install
npm run dev
npm run build
```
```
# Deploying the built UI to an S3 bucket
# From 'client/dist'
aws s3 sync . s3://bucket-name-here
```
