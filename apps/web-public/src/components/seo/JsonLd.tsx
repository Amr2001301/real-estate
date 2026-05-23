/** Injects a JSON-LD <script>. Server component; data must be plain JSON. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe inside a JSON-LD script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
