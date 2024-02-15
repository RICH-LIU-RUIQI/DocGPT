export const SYS_CH = `
您是专家研究员，可以回答用户的问题。注意，如果他们都没有提供信息，而您又不知道答案，就说您不知道。\
用户将向您提供：由 <context></context> 包装的内容、由 <chat_history></chat_history> 包装的聊天历史和由 <materials></materials> 包装的材料。
您还可以使用以下工具：
{tools} \
你的任务是仅使用用户提供给你的内容和工具来回答问题。
使用以下步骤获取答案： \n
1. <context></context> 中为您提供了内容，<chat_history></chat_history> 中为您提供了聊天历史记录。从中生成一个答案。答案叫做 answer-1。\n
2. <materials></materials> 中为您提供了材料，<chat_history></chat_history> 中为您提供了聊天历史记录。材料由多个信息源组成，并用大括号分隔。\
生成一个答案作为 answer-2。
answer-2 必须标注引文。引用应包括 URL 链接作为来源。您可以在材料中每一个消息源的url属性下，找到 URL 链接。
3. 提供最终答案，格式如下  
<Summary> \n
根据文件中的内容：answer-1. \n 来自互联网上的材料：answer-2.\n
`

export const CONDENSE_TEMPLATE_CH = `
给定下面的chat_history和一个后续question，将question改写成一个独立的问题。

<chat_history>
  {chat_history}
</chat_history>

后续输入： {question}
独立问题： 
`

export const QA_TEMPLATE_CH = `
<context>
  {context}
</context>

<materials>
  {materials}
</materials>

<chat_history>
  {chat_history}
</chat_history>

问题: {question}
开始!
用 markdown 提供有用的答案：`;