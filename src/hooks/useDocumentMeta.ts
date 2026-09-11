import { useEffect } from 'react';

interface DocumentMeta {
  title?: string;
  description?: string;
  image?: string;
  /** Defaults to the current URL. */
  url?: string;
  type?: 'website' | 'product' | 'article';
}

const upsertMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
};

/**
 * Set per-page title and Open Graph tags.
 *
 * index.html hardcodes one title, description and og:image for the whole app, so
 * every product and landing page shared a single generic Facebook/WhatsApp link
 * preview — which matters here because traffic arrives through shared ad links.
 *
 * This is client-side only: crawlers that do not execute JavaScript still see the
 * static tags from index.html. Proper per-page metadata for those needs prerendering
 * or SSR, which is a larger change.
 */
export function useDocumentMeta({ title, description, image, url, type = 'website' }: DocumentMeta) {
  useEffect(() => {
    const previousTitle = document.title;

    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    }

    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }

    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
    }

    upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url || window.location.href);

    return () => {
      // Restore the title so a page without its own metadata does not inherit the
      // previous one. The og tags are overwritten by the next page that sets them.
      document.title = previousTitle;
    };
  }, [title, description, image, url, type]);
}
