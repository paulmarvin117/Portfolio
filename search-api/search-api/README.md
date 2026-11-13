# Portfolio search service

A tiny Azure Function (Python) that lets the Safari window in the portfolio show real Google
results and Google Images. It calls SerpApi, trims the answer, and sends it back to the page.
Your SerpApi key stays on the server.

## One-time setup

1. **SerpApi key.** Create a free account at https://serpapi.com and copy your API key.
2. **Function App.** In the Azure portal create a Function App: Python 3.11, Consumption or
   Flex Consumption plan.
3. **Settings.** In the Function App open Environment variables and add:
   - `SERPAPI_KEY` = your key
   - `ALLOWED_ORIGIN` = the address of your portfolio, for example `https://paulmarvin.dev`
     (use commas for more than one, and include `http://localhost:8000` while testing)
4. **Deploy.** From this folder, with Azure Functions Core Tools installed:

       func azure functionapp publish YOUR-APP-NAME

5. **Connect the page.** Open `script.js` and set, near the top:

       var SEARCH_API = 'https://YOUR-APP-NAME.azurewebsites.net/api/search';

Search with the Google or Google Images option in Safari and real results appear in the window.

## How it behaves

- `GET /api/search?q=python&type=web` returns web results, a knowledge card, an answer box,
  related questions and related searches.
- `GET /api/search?q=python&type=images` returns images. Add `&page=1`, `&page=2`... for more.
- Results are cached for 10 minutes, so repeat searches do not use up your SerpApi quota.
- Requests from any address other than `ALLOWED_ORIGIN` are refused.
- The free SerpApi plan has a monthly limit. When it runs out, the page quietly falls back to
  opening Google in a new tab.

## Test it

    pip install azure-functions
    python test_function.py
