import Link from 'next/link';

export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">About</h1>
      <div className="space-y-4 text-zinc-600 dark:text-zinc-400">
        <p>
          <em className="font-medium text-zinc-900 not-italic dark:text-zinc-100">
            <Link
              href="https://github.com/rexledesma/foodcoop.news"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              foodcoop.news
            </Link>
          </em>{' '}
          was created as a convenient site to stay in the loop with the{' '}
          <Link
            href="https://www.foodcoop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Park Slope Food Coop
          </Link>
          .
        </p>
        <p>You can...</p>
        <ul className="list-inside list-disc space-y-2">
          <li>Browse an assortment of feeds related to the Coop</li>
          <li>Add your Coop membership card to your Apple Wallet or Google Wallet</li>
          <li>Sync your favorite available work shifts to Google, Outlook, or Apple Calendar</li>
        </ul>
        <p>
          This is a project by{' '}
          <Link
            href="https://rexledesma.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Rex Ledesma
          </Link>
          , inspired by the{' '}
          <Link
            href="https://apps.apple.com/sa/app/park-slope-food-coop/id1236581358"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Park Slope Food Coop App
          </Link>
          . If you have any feedback, please{' '}
          <a
            href="mailto:rex.ledesma1@gmail.com"
            className="underline transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            email me
          </a>
          !
        </p>
      </div>
    </div>
  );
}
