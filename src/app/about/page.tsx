import Link from "next/link";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        About
      </h1>
      <div className="space-y-4 text-zinc-600 dark:text-zinc-400">
        <p>
          <em className="text-zinc-900 dark:text-zinc-100 not-italic font-medium">
            <Link
              href="https://github.com/rexledesma/foodcoop.news"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              foodcoop.news
            </Link>
          </em>{" "}
          was created as a convenient site to stay in the loop with the{" "}
          <Link
            href="https://www.foodcoop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Park Slope Food Coop
          </Link>
          .
        </p>
        <p>You can...</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Browse an assortment of feeds related to the Coop</li>
          <li>
            Add your Coop membership card to your Apple Wallet or Google Wallet
          </li>
          <li>
            Sync your favorite available work shifts to Google, Outlook, or
            Apple Calendar
          </li>
        </ul>
        <p>
          This is a project by{" "}
          <Link
            href="https://rexledesma.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Rex Ledesma
          </Link>
          , inspired by the{" "}
          <Link
            href="https://apps.apple.com/sa/app/park-slope-food-coop/id1236581358"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Park Slope Food Coop App
          </Link>
          . If you have any feedback, please{" "}
          <a
            href="mailto:rex.ledesma1@gmail.com"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            email me
          </a>
          !
        </p>
      </div>
    </div>
  );
}
