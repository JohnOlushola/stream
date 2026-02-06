/**
 * Benchmark fixtures — realistic text samples at varying lengths.
 */

export const SHORT =
  "convert 10 km to miles";

export const MEDIUM =
  "Hi alice@example.com, the meeting is on January 15, 2025 at 14:30. " +
  "The venue is 5 km from downtown. Call me at 555-123-4567 or visit " +
  "https://example.com/schedule for details. Budget is 500 kg of supplies.";

export const LONG =
  "Dear team,\n\n" +
  "Please review the following logistics for our upcoming event on March 20, 2025:\n\n" +
  "1. Venue is located 12.5 km from the airport. Shuttle departs at 08:30 and 14:00.\n" +
  "2. Total cargo: 350 kg of equipment + 120 kg of materials = 470 kg.\n" +
  "3. Contact: john@logistics.com or sarah@events.org. Phone: +1-555-987-6543.\n" +
  "4. Booking portal: https://events.example.com/book?ref=2025-march\n" +
  "5. Alternate date: April 3, 2025 (tomorrow if we're lucky).\n" +
  "6. Storage facility is 800 m from the venue, capacity 2,500 kg.\n" +
  "7. Registration deadline: Feb 28, 2025. Late fee: $50.\n" +
  "8. Emergency contact: ops@events.org, phone 555-111-2222.\n" +
  "9. Parking is 200 m away. Shuttle covers 3.5 km route every 15 min.\n" +
  "10. Final walkthrough scheduled for 16:45 on March 19, 2025.\n\n" +
  "Please confirm by replying to admin@example.com or visiting https://example.com/confirm.\n" +
  "Looking forward to seeing everyone there.\n\nBest regards";

/** Simulates incremental typing — returns progressively longer slices */
export function typingSequence(text: string, step = 1): string[] {
  const slices: string[] = [];
  for (let i = step; i <= text.length; i += step) {
    slices.push(text.slice(0, i));
  }
  if (slices[slices.length - 1] !== text) {
    slices.push(text);
  }
  return slices;
}
