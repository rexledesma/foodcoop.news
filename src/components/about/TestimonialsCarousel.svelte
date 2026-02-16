<script lang="ts">
  type Testimonial = {
    quote: string;
    url: string;
    source: string;
  };

  const testimonials: Testimonial[] = [
    {
      quote: 'This is so rad',
      url: 'https://www.reddit.com/r/parkslopefoodcoop/comments/1qw391v/comment/o3nug8r/',
      source: 'r/parkslopefoodcoop',
    },
    {
      quote:
        "This is so cool. Thank you for creating and sharing it! I've been running around to different markets lately trying to find the best prices and manually tracking whenever I go - I didn't even realize the coop posted their produce daily. Super helpful.",
      url: 'https://www.reddit.com/r/parkslopefoodcoop/comments/1qw391v/comment/o3r24hf/',
      source: 'r/parkslopefoodcoop',
    },
    {
      quote: 'absolutely love the Price Drop and Price Increase tracking! thank you!!! this rules',
      url: 'https://www.reddit.com/r/parkslopefoodcoop/comments/1qw391v/comment/o3q93gl/',
      source: 'r/parkslopefoodcoop',
    },
    {
      quote: 'This is cool, thanks!',
      url: 'https://www.reddit.com/r/parkslope/comments/1qnqgv6/comment/o1wl7cm/',
      source: 'r/parkslope',
    },
    {
      quote: 'Very cool! Thanks for doing this!',
      url: 'https://www.reddit.com/r/parkslope/comments/1qnqgv6/comment/o21b7fb/',
      source: 'r/parkslope',
    },
    {
      quote: 'This is great!',
      url: 'https://www.reddit.com/r/parkslope/comments/1qnqgv6/comment/o25ew1x/',
      source: 'r/parkslope',
    },
    {
      quote: "This is nicely done! Didn't know that the coop posted so much on bluesky",
      url: 'https://www.reddit.com/r/parkslope/comments/1qnqgv6/comment/o1wrbni/',
      source: 'r/parkslope',
    },
  ];

  const loopedTestimonials = [...testimonials, ...testimonials];
  let isTouchPaused = $state(false);
</script>

<div class="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
  <div
    class="marquee-shell overflow-hidden"
    role="region"
    aria-label="Testimonials carousel"
    ontouchstart={() => (isTouchPaused = true)}
    ontouchend={() => (isTouchPaused = false)}
    ontouchcancel={() => (isTouchPaused = false)}
  >
    <div
      class={`marquee-track flex w-max gap-3 py-1 motion-reduce:animate-none ${isTouchPaused ? 'marquee-paused' : ''}`}
    >
      {#each loopedTestimonials as testimonial, index (`${testimonial.url}-${index}`)}
        <a
          href={testimonial.url}
          target="_blank"
          rel="noopener noreferrer"
          class="group w-[20rem] shrink-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <div class="mb-2">
            <span class="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
              {testimonial.source}
            </span>
          </div>
          <blockquote class="text-sm leading-relaxed text-zinc-800">
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>
        </a>
      {/each}
    </div>
  </div>
</div>

<style>
  .marquee-track {
    animation: testimonials-marquee 55s linear infinite;
  }

  .marquee-shell:hover .marquee-track,
  .marquee-shell:active .marquee-track {
    animation-play-state: paused;
  }

  .marquee-track a {
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease,
      background-color 180ms ease;
    cursor: pointer;
  }

  .marquee-track a:hover,
  .marquee-track a:focus-visible {
    transform: translateY(-2px);
    border-color: #a1a1aa;
    box-shadow: 0 10px 24px -16px rgba(0, 0, 0, 0.55);
    background-color: #fafafa;
  }

  .marquee-track a:focus-visible {
    outline: 2px solid #a1a1aa;
    outline-offset: 2px;
  }

  .marquee-paused {
    animation-play-state: paused;
  }

  @keyframes testimonials-marquee {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(-50%);
    }
  }
</style>
