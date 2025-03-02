<script lang="ts">


  import { onDestroy } from "svelte";
  
  const startDate = new Date("2012-12-01T00:00:00Z");
  let elapsedTime = Date.now() - startDate.getTime();

  const interval = setInterval(() => {
    elapsedTime = Date.now() - startDate.getTime();
  }, 1000);

  
  onDestroy(() => clearInterval(interval));

  function formatElapsedTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30.44); // Approximation des mois
    const years = Math.floor(months / 12);

    return {
      years,
      months: months % 12,
      days: days % 30.44 | 0,
      hours: String(hours % 24).padStart(2, "0"),
      minutes: String(minutes % 60).padStart(2, "0"),
      seconds: String(seconds % 60).padStart(2, "0")
    };
  }

</script>

<main>
  <p>Foreground Eclipse last album was released </p>
  {#await Promise.resolve(formatElapsedTime(elapsedTime)) then time}
    <h1>{time.years} Years, {time.months} Months, {time.days} Days,
    {time.hours}:{time.minutes}:{time.seconds} ago</h1>
  {/await}

</main>

<style>

</style>
