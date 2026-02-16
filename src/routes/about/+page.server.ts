export async function load() {
  try {
    const response = await fetch('https://api.github.com/repos/rexledesma/foodcoop.news', {
      headers: { Accept: 'application/vnd.github+json' },
    });

    if (!response.ok) {
      return { starCountLabel: '...' };
    }

    const data: { stargazers_count?: number } = await response.json();
    if (typeof data.stargazers_count !== 'number') {
      return { starCountLabel: '...' };
    }

    return {
      starCountLabel: new Intl.NumberFormat('en-US').format(data.stargazers_count),
    };
  } catch {
    return { starCountLabel: '...' };
  }
}
