<script lang="ts">
  import TestimonialsCarousel from './TestimonialsCarousel.svelte';

  let { starCountLabel = '...' }: { starCountLabel?: string } = $props();
</script>

<div class="mx-auto max-w-3xl px-4 py-6">
  <div class="space-y-4 text-zinc-600">
    <p>
      <em class="font-medium text-zinc-900 not-italic">
        <a
          href="https://github.com/rexledesma/foodcoop.news"
          target="_blank"
          rel="noopener noreferrer"
          class="underline transition-colors hover:text-zinc-900"
        >
          foodcoop.news
        </a>
      </em>
      was created as a convenient site to stay in the loop with the
      <a
        href="https://www.foodcoop.com"
        target="_blank"
        rel="noopener noreferrer"
        class="underline transition-colors hover:text-zinc-900"
      >
        Park Slope Food Coop
      </a>.
    </p>
    <p>You can...</p>
    <ul class="list-inside list-disc space-y-2">
      <li>Browse an assortment of feeds related to the Coop</li>
      <li>Search the Coop's produce for selection and pricing information</li>
      <li>Add your Coop membership card to your Apple Wallet or Google Wallet</li>
      <li>Sync your favorite available work shifts to Google, Outlook, or Apple Calendar</li>
    </ul>
    <section class="space-y-2">
      <h2 class="text-xl font-semibold text-zinc-900">Testimonials</h2>
      <TestimonialsCarousel />
    </section>
    <section class="space-y-2">
      <h2 class="text-xl font-semibold text-zinc-900">How to support this project</h2>
      <ul class="list-inside list-disc space-y-2">
        <li>Tell your friends at the Coop about foodcoop.news</li>
        <li>
          Write a review on the
          <a
            href="https://linewaitersgazette.com/about/"
            target="_blank"
            rel="noopener noreferrer"
            class="underline transition-colors hover:text-zinc-900"
          >
            Linewaiters' Gazette
          </a>
        </li>
        <li>
          Contribute your feature suggestions and bug reports on
          <a
            href="https://github.com/rexledesma/foodcoop.news/issues"
            target="_blank"
            rel="noopener noreferrer"
            class="underline transition-colors hover:text-zinc-900"
          >
            GitHub
          </a>
          (or
          <a
            href="mailto:rex.ledesma1@gmail.com"
            class="underline transition-colors hover:text-zinc-900"
          >
            email me
          </a>)
        </li>
        <li>
          Star this project on
          <a
            href="https://github.com/rexledesma/foodcoop.news"
            target="_blank"
            rel="noopener noreferrer"
            class="underline transition-colors hover:text-zinc-900"
          >
            GitHub
          </a>
        </li>
        <li>
          Support the server costs and sponsor my work on
          <a
            href="https://github.com/sponsors/rexledesma"
            target="_blank"
            rel="noopener noreferrer"
            class="underline transition-colors hover:text-zinc-900"
          >
            GitHub
          </a>
          <div class="mt-2 flex justify-center gap-2">
            <a
              href="https://github.com/rexledesma/foodcoop.news"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={"Star repository (" + starCountLabel + ")"}
              class="group inline-flex items-stretch rounded-md border border-zinc-300 text-sm font-medium text-zinc-900 transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:-translate-y-0.5 focus-visible:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-none active:-translate-y-0.5 active:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)]"
            >
              <span class="inline-flex items-center justify-center rounded-l-md bg-zinc-100 px-3 py-1.5 text-center transition-colors group-hover:bg-zinc-200 group-focus-visible:bg-zinc-200 group-active:bg-zinc-200">
                ⭐ Star
              </span>
              <span class="inline-flex min-w-8 items-center justify-center rounded-r-md border-l border-zinc-300 bg-white px-2 py-1 text-center transition-colors group-hover:bg-zinc-50 group-focus-visible:bg-zinc-50 group-active:bg-zinc-50">
                {starCountLabel}
              </span>
            </a>
            <a
              href="https://github.com/sponsors/rexledesma"
              target="_blank"
              rel="noopener noreferrer"
              class="group relative inline-flex items-center justify-center rounded-md border border-zinc-300 bg-zinc-100 px-3 py-1.5 text-center text-sm font-medium text-zinc-900 transition-all hover:-translate-y-0.5 hover:bg-zinc-200 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:-translate-y-0.5 focus-visible:bg-zinc-200 focus-visible:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)] focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-none active:-translate-y-0.5 active:bg-zinc-200 active:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.55)]"
            >
              <span class="absolute top-0 -left-1 text-xs opacity-0 transition-all group-hover:-translate-x-0.5 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-visible:-translate-x-0.5 group-focus-visible:-translate-y-1 group-focus-visible:opacity-100 group-active:-translate-x-0.5 group-active:-translate-y-1 group-active:opacity-100">
                ✨
              </span>
              <span class="absolute -right-1 bottom-0 text-xs opacity-0 transition-all group-hover:translate-x-0.5 group-hover:translate-y-1 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:translate-y-1 group-focus-visible:opacity-100 group-active:translate-x-0.5 group-active:translate-y-1 group-active:opacity-100">
                ✨
              </span>
              <span>💖 Sponsor</span>
            </a>
          </div>
        </li>
      </ul>
    </section>
    <p>
      This is an
      <a
        href="https://github.com/rexledesma/foodcoop.news"
        target="_blank"
        rel="noopener noreferrer"
        class="underline transition-colors hover:text-zinc-900"
      >
        open-source project
      </a>
      by
      <a
        href="https://rexledesma.com"
        target="_blank"
        rel="noopener noreferrer"
        class="underline transition-colors hover:text-zinc-900"
      >
        Rex Ledesma
      </a>, inspired by the
      <a
        href="https://apps.apple.com/sa/app/park-slope-food-coop/id1236581358"
        target="_blank"
        rel="noopener noreferrer"
        class="underline transition-colors hover:text-zinc-900"
      >
        Park Slope Food Coop App
      </a>. If you have any feedback, please
      <a href="mailto:rex.ledesma1@gmail.com" class="underline transition-colors hover:text-zinc-900">
        email me
      </a>
      !
    </p>
    <section class="space-y-2">
      <h2 class="text-xl font-semibold text-zinc-900">Acknowledgments</h2>
      <p>
        Special thanks to
        <a
          href="https://johnresig.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="underline transition-colors hover:text-zinc-900"
        >
          John Resig
        </a>, former member of the web committee, for preserving and graciously sharing Park Slope
        Food Coop produce snapshot data from August 2013 through January 2026.
      </p>
    </section>
  </div>
</div>
