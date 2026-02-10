import Link from 'next/link';

import TestimonialsCarousel from '@/components/TestimonialsCarousel';

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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">About</h1>
      <div className="space-y-4 text-zinc-600">
        <p>
          <em className="font-medium text-zinc-900 not-italic">
            <Link
              href="https://github.com/rexledesma/foodcoop.news"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-zinc-900"
            >
              foodcoop.news
            </Link>
          </em>{' '}
          was created as a convenient site to stay in the loop with the{' '}
          <Link
            href="https://www.foodcoop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900"
          >
            Park Slope Food Coop
          </Link>
          .
        </p>
        <p>You can...</p>
        <ul className="list-inside list-disc space-y-2">
          <li>Browse an assortment of feeds related to the Coop</li>
          <li>Search the Coop&apos;s produce for selection and pricing information</li>
          <li>Add your Coop membership card to your Apple Wallet or Google Wallet</li>
          <li>Sync your favorite available work shifts to Google, Outlook, or Apple Calendar</li>
        </ul>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-900">Testimonials</h2>
          <TestimonialsCarousel />
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-zinc-900">How to support this project</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>Tell your friends at the Coop about foodcoop.news</li>
            <li>
              Write a review on the{' '}
              <Link
                href="https://linewaitersgazette.com/about/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-zinc-900"
              >
                Linewaiters&apos; Gazette
              </Link>
            </li>
            <li>
              Contribute your feature suggestions and bug reports on{' '}
              <Link
                href="https://github.com/rexledesma/foodcoop.news/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-zinc-900"
              >
                GitHub
              </Link>{' '}
              (or{' '}
              <a
                href="mailto:rex.ledesma1@gmail.com"
                className="underline transition-colors hover:text-zinc-900"
              >
                email me
              </a>
              )
            </li>
            <li>
              Support the server costs and sponsor my work on{' '}
              <Link
                href="https://github.com/sponsors/rexledesma"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-zinc-900"
              >
                GitHub
              </Link>
              <div className="mt-2 flex justify-center">
                <Link
                  href="https://github.com/sponsors/rexledesma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-all hover:-translate-y-0.5 hover:bg-zinc-200 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:-translate-y-0.5 focus-visible:bg-zinc-200 focus-visible:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-none active:-translate-y-0.5 active:bg-zinc-200 active:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)]"
                >
                  <span className="absolute top-0 -left-1 text-xs opacity-0 transition-all group-hover:-translate-x-0.5 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-x-0.5 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100 group-active:-translate-x-0.5 group-active:-translate-y-1 group-active:opacity-100">
                    ✨
                  </span>
                  <span className="absolute -right-1 bottom-0 text-xs opacity-0 transition-all group-hover:translate-x-0.5 group-hover:translate-y-1 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:translate-y-1 group-focus-visible:opacity-100 group-active:translate-x-0.5 group-active:translate-y-1 group-active:opacity-100">
                    ✨
                  </span>
                  <span>💖 Sponsor on GitHub</span>
                </Link>
              </div>
            </li>
          </ul>
        </section>
        <p>
          This is an{' '}
          <Link
            href="https://github.com/rexledesma/foodcoop.news"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900"
          >
            open-source project
          </Link>{' '}
          by{' '}
          <Link
            href="https://rexledesma.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900"
          >
            Rex Ledesma
          </Link>
          , inspired by the{' '}
          <Link
            href="https://apps.apple.com/sa/app/park-slope-food-coop/id1236581358"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-zinc-900"
          >
            Park Slope Food Coop App
          </Link>
          . If you have any feedback, please{' '}
          <a
            href="mailto:rex.ledesma1@gmail.com"
            className="underline transition-colors hover:text-zinc-900"
          >
            email me
          </a>
          !
        </p>
      </div>
    </div>
  );
}
