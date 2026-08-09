'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PublicIcon } from '../../components/PublicIcon';
import { createClient } from '../../lib/supabase-browser';
import {
  AI_INTAKE_MAX_FILES,
  AI_INTAKE_SESSION_KEY,
  cacheAiIntakeFiles,
  normalizeAiIntakeLinks,
  validateAiIntakeFile,
  type AiCampaignIntake,
} from '../../lib/campaign-ai-intake';

const POPULAR_REQUESTS = [
  ['heart', 'Medical fundraiser', 'for a loved one'],
  ['shield', 'Emergency relief', 'needed right now'],
  ['users', 'Memorial fund', 'for my community'],
  ['globe', 'Nonprofit campaign', 'for my cause'],
  ['dollar', 'Education fundraiser', 'for tuition or school'],
] as const;

export default function AiCampaignPage() {
  return (
    <Suspense fallback={null}>
      <AiCampaignPrompt />
    </Suspense>
  );
}

function AiCampaignPrompt() {
  const router = useRouter();
  const params = useSearchParams();
  const [prompt, setPrompt] = useState(() => params.get('q') ?? '');
  const [linkDraft, setLinkDraft] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const speechWindow = window as Window & SpeechRecognitionWindow;
    const availabilityCheck = window.setTimeout(() => {
      setHydrated(true);
      setVoiceAvailable(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    }, 0);
    return () => {
      window.clearTimeout(availabilityCheck);
      recognitionRef.current?.stop();
    };
  }, []);

  const addLink = () => {
    const normalized = normalizeAiIntakeLinks([linkDraft]);
    if (normalized.invalid.length > 0 || normalized.links.length === 0) {
      setError('Enter a complete http or https link.');
      return;
    }
    setLinks((current) => [...new Set([...current, ...normalized.links])].slice(0, 5));
    setLinkDraft('');
    setError('');
  };

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      const fileError = validateAiIntakeFile(file);
      if (fileError) { setError(fileError); continue; }
      if (next.some((item) => item.name === file.name && item.size === file.size)) continue;
      if (next.length >= AI_INTAKE_MAX_FILES) { setError(`Add up to ${AI_INTAKE_MAX_FILES} files.`); break; }
      next.push(file);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as Window & SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setError('Voice input is not available in this browser.'); return; }
    const recognition = new Recognition();
    recognition.lang = document.documentElement.lang || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      if (transcript) {
        setPrompt((current) => `${current.trim()}${current.trim() ? ' ' : ''}${transcript}`.slice(0, 4000));
      }
    };
    recognition.onerror = () => { setListening(false); setError('Voice input stopped. You can keep typing.'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setError('');
    setListening(true);
    recognition.start();
  };

  const start = async () => {
    const campaignPrompt = prompt.trim();
    if (campaignPrompt.length < 10) {
      setError('Tell us a little more so we can build a useful first draft.');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const cachedFiles = await cacheAiIntakeFiles(files);
      if (files.length > 0 && cachedFiles.length !== files.length) {
        throw new Error('We could not safely hold your attachments. Remove them or try again.');
      }
      const intake: AiCampaignIntake = {
        version: 1,
        path: 'ai',
        prompt: campaignPrompt.slice(0, 4000),
        links,
        files: cachedFiles,
        createdAt: Date.now(),
      };
      sessionStorage.setItem(AI_INTAKE_SESSION_KEY, JSON.stringify(intake));
      const { data: { user } } = await createClient().auth.getUser();
      router.push(user
        ? '/create?path=ai&intake=1'
        : `/login?next=${encodeURIComponent('/create?path=ai&intake=1')}`);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Your campaign could not be started. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="pub-page ai-builder-page">
      <div className="pub-breadcrumb">
        <Link href="/">Home</Link> <span>&gt;</span> <Link href="/create/choose-path">Start a campaign</Link> <span>&gt;</span> <b>Build with AI</b>
      </div>

      <section className="ai-intake-shell" aria-labelledby="ai-intake-title">
        <div className="ai-intake-mark" aria-hidden="true"><PublicIcon name="ai" /></div>
        <p className="ai-intake-kicker">Build with AI</p>
        <h1 id="ai-intake-title" className="ai-builder-greeting">Tell us what you&apos;re raising money for.</h1>
        <p className="ai-builder-sub">
          We&apos;ll create a complete, editable draft and ask only for details that are still missing.
        </p>

        <form className="ai-builder-form" onSubmit={(event) => { event.preventDefault(); void start(); }}>
          <div className="ai-builder-input">
            <textarea
              aria-label="Describe the cause you want to raise money for"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, 4000))}
              placeholder="For example: My sister needs help covering surgery and six weeks away from work. We hope to raise $12,000 by November."
              rows={6}
            />
            <span className="ai-intake-count">{prompt.length}/4000</span>
          </div>

          <div className="ai-intake-tools" aria-label="Optional campaign context">
            {voiceAvailable && (
              <button type="button" className={listening ? 'is-active' : ''} onClick={toggleVoice} aria-pressed={listening}>
                <PublicIcon name="mic" /> {listening ? 'Listening' : 'Use voice'}
              </button>
            )}
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <PublicIcon name="upload" /> Add photos or files
            </button>
            <input
              ref={fileInputRef}
              className="cl-visually-hidden"
              type="file"
              aria-label="Add campaign photos or supporting documents"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,.doc,.docx,text/plain"
              onChange={(event) => addFiles(event.target.files)}
            />
          </div>

          <div className="ai-intake-link-row">
            <PublicIcon name="link" />
            <input
              type="url"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              placeholder="Add a helpful link (optional)"
              aria-label="Helpful campaign link"
            />
            <button type="button" onClick={addLink} disabled={!linkDraft.trim()}>Add</button>
          </div>

          {(links.length > 0 || files.length > 0) && (
            <ul className="ai-intake-attachments" aria-label="Added context">
              {links.map((link) => (
                <li key={link}>
                  <PublicIcon name="link" /><span>{link}</span>
                  <button type="button" onClick={() => setLinks((current) => current.filter((item) => item !== link))} aria-label={`Remove ${link}`}><PublicIcon name="x" /></button>
                </li>
              ))}
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <PublicIcon name={file.type.startsWith('image/') ? 'image' : 'document'} /><span>{file.name}</span>
                  <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}><PublicIcon name="x" /></button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="ai-intake-error" role="alert">{error}</p>}

          <button type="submit" className="ai-intake-submit" disabled={!hydrated || starting}>
            <PublicIcon name="ai" /> {starting ? 'Building your draft...' : 'Build my campaign'} <PublicIcon name="arrow" />
          </button>
          <p className="ai-intake-save"><PublicIcon name="refresh" /> Your campaign autosaves after it is built, so you can resume on any device.</p>
        </form>

        <h2 className="ai-builder-popular">Popular requests</h2>
        <div className="ai-builder-chips">
          {POPULAR_REQUESTS.map(([icon, title, sub]) => (
            <button key={title} type="button" onClick={() => setPrompt(`${title} ${sub}`)}>
              <PublicIcon name={icon} />
              <span>{title}<br />{sub}</span>
            </button>
          ))}
        </div>

        <p className="ai-builder-secure"><PublicIcon name="lock" /> Review every generated detail before publishing.</p>
      </section>
    </div>
  );
}

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};
