import AboutPageClient from '@/components/about/AboutPageClient';

export const metadata = {
  title: 'About',
  description:
    'Learn about foodcoop.news and how it helps Park Slope Food Coop members stay informed.',
  openGraph: {
    title: 'About · foodcoop.news',
    description:
      'Learn about foodcoop.news and how it helps Park Slope Food Coop members stay informed.',
  },
};

async function getGitHubStarCount(): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/repos/rexledesma/foodcoop.news', {
      next: { revalidate: 3600 },
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) return null;

    const data: { stargazers_count?: number } = await response.json();
    if (typeof data.stargazers_count !== 'number') return null;

    return new Intl.NumberFormat('en-US').format(data.stargazers_count);
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const starCount = await getGitHubStarCount();
  const starCountLabel = starCount ?? '...';

  return <AboutPageClient starCountLabel={starCountLabel} />;
}
