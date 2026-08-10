export async function register() {
  // Only run in Node.js runtime — not Edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startVacancyScheduler } = await import('./lib/vacancy-scheduler')
    startVacancyScheduler()
  }
}
