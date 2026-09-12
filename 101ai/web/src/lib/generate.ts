import { API_URL, getToken } from './api'

export interface GeneratedDraft {
  title: string
  content: string
}

// Current note state to revise, when this is a follow-up ask inside a note
// that's already been started (see NoteEditor.tsx's in-note compose bar) —
// omitted when starting a brand-new note from scratch (ToolDashboard's
// "Generate with AI" option). Without this the backend has no idea what
// it's editing — see OpenAiController.generate for what it does with it.
export interface NoteContext {
  title: string
  body: string
}

// Single-shot generation, no chat thread created — see OpenAiController.
// Only used for a hideChatsTab tool (currently just writer), whose compose
// FAB routes the AI-generate option here instead of into a chat. Returns a
// real title alongside the content (from the writer tool's structured
// json_schema reply — see tool-config.ts's WRITER_SCHEMA), rather than
// leaving the caller to guess one from the content's own first line, which
// used to pick up whatever the model's opening words happened to be —
// including a conversational preamble or a raw markdown bullet marker.
export async function generateContent(
  toolSlug: string,
  prompt: string,
  noteContext?: NoteContext,
): Promise<GeneratedDraft> {
  const response = await fetch(`${API_URL}/tools/${toolSlug}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      prompt,
      noteTitle: noteContext?.title,
      noteBody: noteContext?.body,
    }),
  })
  if (!response.ok) throw new Error(`Failed to generate: ${response.status}`)
  return response.json()
}
