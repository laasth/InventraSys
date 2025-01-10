export function formatDateTime(dateStr, t) {
  if (!dateStr) return '';
  
  // SQLite datetime format: YYYY-MM-DD HH:MM:SS
  // Parse manually to ensure consistent behavior
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  
  // Create date in UTC
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const now = new Date();
  
  // Calculate time difference in milliseconds
  const diffMs = now.getTime() - date.getTime();
  const remainingMs = diffMs % (1000 * 60 * 60 * 24);
  const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
  
  // Calculate each time unit independently
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  
  // Return appropriate format based on time difference
  if (days > 0) return t('time.daysAgo', { days });
  if (hours > 0) return t('time.hoursAgo', { hours });
  if (minutes > 0) return t('time.minutesAgo', { minutes });
  return t('time.justNow');
}
