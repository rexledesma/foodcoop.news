<script lang="ts">
  import TestimonialsCarousel from './TestimonialsCarousel.svelte';
</script>

<div class="mx-auto max-w-3xl px-4 pb-6">
  <div class="py-6">
    <h1 class="text-2xl font-bold text-zinc-900">About</h1>
  </div>
  <div class="space-y-4 text-zinc-600">
    <p>
      <em class="font-medium text-zinc-900 not-italic">
        foodcoop.news
      </em>
      was created as an app to stay in the loop with the
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
      <li>Read past, current, and upcoming agenda items for general meetings</li>
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
          or reach out by
          <a
            href="mailto:rex.r.ledesma@gmail.com"
            class="underline transition-colors hover:text-zinc-900"
          >
            email
          </a>
        </li>
      </ul>
    </section>
    <section class="space-y-2">
      <h2 class="text-xl font-semibold text-zinc-900">Acknowledgments</h2>
      <p>
        The foodcoop.news app was created and
        <a
          href="https://github.com/rexledesma/foodcoop.news"
          target="_blank"
          rel="noopener noreferrer"
          class="underline transition-colors hover:text-zinc-900"
        >
          open-sourced
        </a>
        by
        <a
          href="https://rexledesma.com"
          target="_blank"
          rel="noopener noreferrer"
          class="underline transition-colors hover:text-zinc-900"
        >
          Rex Ledesma
        </a>.
      </p>
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
