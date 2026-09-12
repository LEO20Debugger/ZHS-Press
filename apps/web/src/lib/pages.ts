const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

export interface EditorialPage {
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

/**
 * Fetches editable copy for a route, or null if there is none.
 *
 * Null is the normal case, not an error: until someone publishes a page in the
 * admin, the route renders the wording built into it. That is what makes
 * drafting safe — an unfinished About page cannot replace the live one, and a
 * mistake is one unpublish away from being undone.
 *
 * Failures are swallowed for the same reason. If the API is unreachable, a
 * marketing page falling back to its built-in copy is a far better outcome
 * than a 500 on the site's second-most-visited route.
 */
export async function getEditorialPage(slug: string): Promise<EditorialPage | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pages/${encodeURIComponent(slug)}`, {
      // Copy changes rarely and is read constantly. A short revalidate keeps
      // the storefront fast while letting an edit appear without a deploy.
      next: { revalidate: 60, tags: [`page:${slug}`] },
    });

    if (!response.ok) return null;
    return (await response.json()) as EditorialPage;
  } catch {
    return null;
  }
}
