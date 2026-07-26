// Bonus: Kth Missing Positive Number on LeetCode
// Submission: https://leetcode.com/problems/kth-missing-positive-number/submissions/2080863390/

export function findKthPositive(arr: number[], k: number): number {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const missing = arr[mid] - (mid + 1);

    if (missing < k) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return left + k;
}
