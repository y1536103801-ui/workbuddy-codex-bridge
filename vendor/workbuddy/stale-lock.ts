/**
 * Recovery from an abandoned writer lock.
 *
 * `@deepseek-ai/dsh-atomic-write` guards every read-modify-write with a
 * `<file>.lock` sibling created `wx`, holding the writer's PID. It takes over a
 * lock only when the record matches `<pid>\n` **and** that PID is gone; any
 * other lock is waited for until the deadline. A lock left behind with an empty
 * body — the window between the exclusive create and the PID write, a process
 * killed at the wrong moment, a file from an older build — therefore matches
 * neither branch and is never reclaimed. Every later writer times out, and the
 * plugin reports whatever its own failure looks like: here, a 401
 * `not_signed_in` on every request, which reads exactly like an expired token
 * and is not one.
 *
 * This helper removes such a file, but only when it is provably ownerless:
 * older than {@link STALE_LOCK_AGE_MS} and naming no live process. A real write
 * holds the lock for milliseconds, so an untouched file that old has no owner.
 *
 * @module dsh-workbuddy-connect/stale-lock
 */

import { readFile, rm, stat } from 'node:fs/promises'

/**
 * Age after which a writer lock with no live owner is removed.
 *
 * Long enough that a genuine write (a few hundred kilobytes of JSON) cannot be
 * mistaken for an abandoned lock; short enough that a crashed writer does not
 * disable the plugin for the rest of the session.
 */
export const STALE_LOCK_AGE_MS = 2 * 60 * 1000

/**
 * Remove `<filename>.lock` when no live process can be holding it.
 *
 * Never throws: a lock that cannot be inspected is left for the normal
 * contention path, which reports the timeout the caller already handles.
 *
 * @param filename - the file whose writer lock should be checked.
 * @returns whether a stale lock was removed.
 */
export async function clearStaleLock(filename: string): Promise<boolean> {
  const lockPath = `${filename}.lock`
  let info
  try {
    info = await stat(lockPath)
  } catch {
    return false
  }
  if (Date.now() - info.mtimeMs < STALE_LOCK_AGE_MS) return false
  let record = ''
  try {
    record = await readFile(lockPath, 'utf8')
  } catch {
    return false
  }
  // A recorded PID that is still alive owns the lock; never take it.
  const recorded = /^(\d+)\n$/u.exec(record)
  if (recorded !== null) {
    const pid = Number(recorded[1])
    if (pid > 0 && pid <= 2_147_483_647) {
      try {
        process.kill(pid, 0)
        return false
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return false
      }
    }
  }
  try {
    await rm(lockPath, { force: true })
    return true
  } catch {
    return false
  }
}
