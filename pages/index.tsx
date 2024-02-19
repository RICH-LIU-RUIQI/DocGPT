import { useRef, useState, useEffect } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { IOSSwitch } from '@/components/ui/Switches';
import SettingsIcon from '@mui/icons-material/Settings';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Document } from 'langchain/document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Button } from '@mui/material';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';

export default function Home() {
  const apiDict = {
    withSearch: '/api/chatWithSearch',
    onlyDocs: '/api/chat',
  };

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [diaShow, setDiaShow] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [functionState, setFunctionState] = useState<{
    search: boolean;
    historySummary: boolean;
    language: number; // 0 for english, 1 for chinese
  }>({
    search: false,
    historySummary: false,
    language: 0,
  });
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: Document[];
  }>({
    messages: [
      {
        message: 'Hi, what would you like to learn about this document?',
        type: 'apiMessage',
      },
    ],
    history: [],
  });

  const { messages, history } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  //handle form submission
  async function handleSubmit(e: any, reGenerate?: any) {
    let api: string;
    let question: string;
    let tmpHistory: [string, string][] | undefined;
    const reQuery = async (): Promise<string> => {
      const questionDict = messages.at(-2) as Message;
      tmpHistory = messageState.history.slice(0, messageState.history.length - 1);
      setMessageState((state) => ({
        history: 
          state.history.slice(0, state.history.length - 1),
        messages: 
          state.messages.slice(0, state.messages.length - 1),
      }));
      return questionDict.message;
    };

    e.preventDefault();

    setError(null);
    if (reGenerate == true) {
      question = await reQuery();
    } else {
      if (!query) {
        alert('Please input a question');
        return;
      }

      question = query.trim();

      setMessageState((state) => ({
        ...state,
        messages: [
          ...state.messages,
          {
            type: 'userMessage',
            message: question,
          },
        ],
      }));
    }

    setLoading(true);
    setQuery('');
    console.log('messageState ===', messageState);

    try {
      api = functionState.search ? apiDict.withSearch : apiDict.onlyDocs;
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history: tmpHistory === undefined ? history : tmpHistory,
          language: functionState.language,
        }),
      });
      const data = await response.json();
      // console.log('data from API ===', data);

      if (data.error) {
        setError(data.error);
      } else {
        setMessageState((state) => ({
          ...state,
          messages: [
            ...state.messages,
            {
              type: 'apiMessage',
              message: data.text,
              sourceDocs: data.sourceDocuments,
            },
          ],
          history: [...state.history, [question, data.text]],
        }));
      }
      console.log('messageState', messageState);

      setLoading(false);

      //scroll to bottom
      messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  //prevent empty submissions
  const handleEnter = (e: any) => {
    if (e.key === 'Enter' && query) {
      handleSubmit(e);
    } else if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <>
      <Layout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginRight: '1%',
          }}
        >
          <SettingsIcon onClick={() => setDiaShow(true)} />
        </div>
        <div className="mx-auto flex flex-col gap-4" id="whole-content">
          <div style={{ display: 'flex' }}>
            <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter ">
              DocChat
            </h1>
            <div id="switch label" style={{ flexGrow: 1 }}>
              <FormControlLabel
                control={
                  <IOSSwitch
                    onChange={(e) => {
                      setFunctionState((state) => ({
                        search: !state.search,
                        historySummary: state.historySummary,
                        language: state.language,
                      }));
                    }}
                  />
                }
                label="Internet Search"
                style={{ float: 'right' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <h4 className=" tracking-tighter ">
              GPT exclusive for your documents :)
            </h4>
            <div id="switch label" style={{ flexGrow: 1 }}>
              <FormControlLabel
                control={
                  <IOSSwitch
                    onChange={(e) => {
                      setFunctionState((state) => ({
                        search: state.search,
                        historySummary: !state.historySummary,
                        language: state.language,
                      }));
                    }}
                  />
                }
                label="History Summary"
                style={{ float: 'right' }}
              />
            </div>
          </div>
          <main className={styles.main}>
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>
                {messages.map((message, index) => {
                  let icon;
                  let className;
                  if (message.type === 'apiMessage') {
                    icon = (
                      <Image
                        key={index}
                        src="/bot-image.png"
                        alt="AI"
                        width="40"
                        height="40"
                        className={styles.boticon}
                        priority
                      />
                    );
                    className = styles.apimessage;
                  } else {
                    icon = (
                      <Image
                        key={index}
                        src="/usericon.png"
                        alt="Me"
                        width="30"
                        height="30"
                        className={styles.usericon}
                        priority
                      />
                    );
                    // The latest message sent by the user will be animated while waiting for a response
                    className =
                      loading && index === messages.length - 1
                        ? styles.usermessagewaiting
                        : styles.usermessage;
                  }
                  return (
                    <>
                      <div key={`chatMessage-${index}`} className={className}>
                        {icon}
                        <div className={styles.markdownanswer}>
                          <ReactMarkdown linkTarget="_blank">
                            {message.message}
                          </ReactMarkdown>
                        </div>
                        <div style={{ marginRight: '3%', flex: 1 }}>
                          {message.type !== 'apiMessage' &&
                            index === messages.length - 2 && (
                              <RestartAltIcon
                                style={{
                                  float: 'right',
                                  fontSize: '30px',
                                  opacity: '0.6',
                                }}
                                onClick={(e) => handleSubmit(e,true)}
                              />
                            )}
                        </div>
                      </div>
                      {message.sourceDocs && (
                        <div
                          className="p-5"
                          key={`sourceDocsAccordion-${index}`}
                        >
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.map((doc, index) => (
                              <div key={`messageSourceDocs-${index}`}>
                                <AccordionItem value={`item-${index}`}>
                                  <AccordionTrigger>
                                    <h3>Source {index + 1}</h3>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ReactMarkdown linkTarget="_blank">
                                      {doc.pageContent}
                                    </ReactMarkdown>
                                    <p className="mt-2">
                                      <b>Source:</b> {doc.metadata.source}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </>
                  );
                })}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={512}
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Waiting for response...'
                        : 'What is this legal case about?'
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generatebutton}
                  >
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="#000" />
                      </div>
                    ) : (
                      // Send icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
        <footer className="m-auto p-4">
          Powered by LangChain.js. Demo built by Rich L.
        </footer>
      </Layout>
      <Dialog
        open={diaShow}
        onClose={() => setDiaShow(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{'Settings'}</DialogTitle>
        <DialogContent>
          <FormControl>
            <FormLabel id="demo-row-radio-buttons-group-label">
              Language
            </FormLabel>
            <RadioGroup
              row
              aria-labelledby="demo-row-radio-buttons-group-label"
              name="row-radio-buttons-group"
              defaultValue={functionState.language}
            >
              <FormControlLabel
                value={0}
                control={
                  <Radio
                    onClick={(e) => {
                      setFunctionState((state) => ({
                        search: state.search,
                        historySummary: state.historySummary,
                        language: 0,
                      }));
                    }}
                  />
                }
                label="English"
              />
              <FormControlLabel
                value={1}
                control={
                  <Radio
                    onClick={(e) => {
                      setFunctionState((state) => ({
                        search: state.search,
                        historySummary: state.historySummary,
                        language: 1,
                      }));
                    }}
                  />
                }
                label="Chinese"
              />
            </RadioGroup>
          </FormControl>
          <DialogContentText id="alert-dialog-description">
            Clear Chat History
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiaShow(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
