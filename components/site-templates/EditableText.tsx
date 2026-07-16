import type { ElementType, ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// EditableText — the copy-node marker for the inline Site Editor.
//
// Renders a PLAIN element (same tag, same className as the node it replaces)
// carrying data-block-id + data-block-field, which the editor's click-capture
// resolves to a block field in the config. Zero behavior change on the public
// site: no client JS, no listeners, no styling — just two data attributes on
// markup that already existed. Server-component safe by construction.
//
// Copy that lives directly on an interactive element (the CTA button labels
// inside <Link>) carries the same two data attributes on the link itself
// instead of gaining a wrapper — see RitualTemplate / EditorialChrome.
// ─────────────────────────────────────────────────────────────────────────────

type EditableTextProps = {
  /** Element to render — defaults to a paragraph. */
  as?: ElementType;
  /** id of the SiteBlock this copy belongs to. */
  blockId: string;
  /** Field path inside the block, e.g. "headline" or "items.0.title". */
  field: string;
  className?: string;
  children: ReactNode;
};

export default function EditableText({
  as: Tag = 'p',
  blockId,
  field,
  className,
  children,
}: EditableTextProps) {
  return (
    <Tag data-block-id={blockId} data-block-field={field} className={className}>
      {children}
    </Tag>
  );
}
