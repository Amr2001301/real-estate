'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TipTapImage from '@tiptap/extension-image';
import {
  Bold, Italic, Heading2, Heading3,
  List, ListOrdered, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { useRef, useState } from 'react';

interface Props {
  name: string;
  dir?: 'ltr' | 'rtl';
  defaultValue?: string;
}

export function ArticleEditor({ name, dir = 'ltr', defaultValue = '' }: Props) {
  const [html, setHtml] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TipTapImage.configure({ inline: false, allowBase64: false }),
    ],
    content: defaultValue,
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
    immediatelyRender: false,
  });

  async function handleImageFile(file: File) {
    if (!editor) return;
    setUploading(true);
    try {
      const presignRes = await fetch('/api-proxy/media/presign', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          folder: 'banners',
          sizeBytes: file.size,
          extension: file.name.split('.').pop(),
        }),
      });
      if (!presignRes.ok) throw new Error(`presign failed (${presignRes.status})`);
      const { uploadUrl, publicUrl } = (await presignRes.json()) as {
        uploadUrl: string;
        publicUrl?: string;
      };
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (publicUrl) {
        editor.chain().focus().setImage({ src: publicUrl }).run();
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-hairline overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-400 transition-all bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-hairline bg-surface-muted/40">
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={!!editor?.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={!!editor?.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <Divider />
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          active={!!editor?.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          active={!!editor?.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolBtn>
        <Divider />
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={!!editor?.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={!!editor?.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolBtn>
        <Divider />
        <ToolBtn
          onClick={() => fileRef.current?.click()}
          active={false}
          title="Insert image"
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5" />
          )}
        </ToolBtn>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        dir={dir}
        className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3
          [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-4
          [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-1.5 [&_.ProseMirror_h3]:mt-3
          [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p]:text-sm [&_.ProseMirror_p]:leading-relaxed
          [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ps-5 [&_.ProseMirror_ul]:mb-2 [&_.ProseMirror_ul_li]:mb-0.5 [&_.ProseMirror_ul_li]:text-sm
          [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ps-5 [&_.ProseMirror_ol]:mb-2 [&_.ProseMirror_ol_li]:mb-0.5 [&_.ProseMirror_ol_li]:text-sm
          [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-3
          [&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_em]:italic
          [&_.ProseMirror.is-editor-empty:before]:content-[attr(data-placeholder)] [&_.ProseMirror.is-editor-empty:before]:text-slate-400 [&_.ProseMirror.is-editor-empty:before]:pointer-events-none [&_.ProseMirror.is-editor-empty:before]:float-start"
      />

      {/* Carry editor HTML into the server-rendered form */}
      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function ToolBtn({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
        active
          ? 'bg-brand-100 text-brand-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-4 bg-hairline mx-1 shrink-0" />;
}
