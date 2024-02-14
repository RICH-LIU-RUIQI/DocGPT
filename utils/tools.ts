import { Calculator } from 'langchain/tools/calculator';
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";

const wikiTool = new WikipediaQueryRun({
  topKResults: 3,
  maxDocContentLength: 1000,
});

const searchTool = new TavilySearchResults({
    apiKey: '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',
    maxResults: 3,
});
  
const allTools = [searchTool, new Calculator(), wikiTool];

export default allTools;