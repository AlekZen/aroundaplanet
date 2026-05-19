import fs from 'node:fs/promises'
import path from 'node:path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const metadata = {
  title: 'Manual del Cliente | AroundaPlanet',
  description: 'Guía paso a paso para clientes de AroundaPlanet.',
}

export const dynamic = 'force-static'

async function loadManual(): Promise<string> {
  const filePath = path.join(process.cwd(), 'src', 'content', 'manuals', 'manual-cliente.md')
  return fs.readFile(filePath, 'utf-8')
}

export default async function ClientManualPage() {
  const md = await loadManual()

  return (
    <article className="mx-auto max-w-3xl space-y-2 px-1 pb-12 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 border-b-2 border-accent pb-2 font-heading text-3xl font-bold text-primary">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 font-heading text-2xl font-semibold text-primary">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 font-heading text-lg font-semibold text-primary-light">{children}</h3>
          ),
          p: ({ children }) => <p className="my-3 leading-relaxed text-foreground/90">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 text-foreground/90">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6 text-foreground/90">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-md border-l-4 border-accent bg-accent-muted/40 px-4 py-2 italic text-foreground/80">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline decoration-accent decoration-2 underline-offset-2 hover:text-primary-light" target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}>
              {children}
            </a>
          ),
          hr: () => <hr className="my-8 border-dashed border-muted-foreground/30" />,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-primary text-primary-foreground">{children}</thead>,
          th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === 'string' ? src : ''}
              alt={alt ?? ''}
              className="my-4 mx-auto block max-w-full rounded-lg border border-border shadow-sm"
              loading="lazy"
            />
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </article>
  )
}
