/**
 * Security Rules Test Matrix — Story 1.4b
 *
 * Firebase emulator not available in CI. Rules validated via:
 * 1. Syntax check: firebase deploy --only firestore:rules (validates compilation)
 * 2. Manual testing via Firebase Console Rules Playground
 * 3. This documented test matrix serves as regression reference
 *
 * To run these with emulator: install @firebase/rules-unit-testing,
 * start emulator, and implement the assertions below.
 */

import { describe, it } from 'vitest'

describe('Firestore Security Rules — Test Matrix', () => {
  describe('/trips/{tripId}', () => {
    // Read: public (no auth required). Write: admin/superadmin only
    it.todo('anyone can read trips (public catalog)')
    it.todo('admin can write trips')
    it.todo('superadmin can write trips')
    it.todo('agente cannot write trips')
    it.todo('unauthenticated cannot write trips')
  })

  describe('/agents/{agentId}/{document=**}', () => {
    // Read: own agentId OR admin/director/superadmin. Write: own agentId only
    it.todo('agent can read own data (agentId match)')
    it.todo('agent cannot read other agent data')
    it.todo('admin can read any agent data')
    it.todo('director can read any agent data')
    it.todo('superadmin can read any agent data')
    it.todo('agent can write own data')
    it.todo('admin cannot write agent data')
  })

  describe('/users/{uid}', () => {
    // Read: owner OR admin/superadmin. Write: owner only
    it.todo('owner can read own document')
    it.todo('owner can write own document')
    it.todo('admin can read any user document')
    it.todo('superadmin can read any user document')
    it.todo('other user cannot read document')
    it.todo('unauthenticated cannot read user document')
  })

  describe('/config/{document=**}', () => {
    // Read: authenticated. Write: never
    it.todo('authenticated user can read config')
    it.todo('nobody can write config')
  })

  describe('default deny (unspecified collections)', () => {
    it.todo('any unspecified collection is denied')
  })
})

describe('Firebase Storage Rules — Test Matrix', () => {
  describe('/users/{uid}/**', () => {
    // Read: owner OR admin/superadmin. Write: owner (max 10MB)
    it.todo('owner can read own files')
    it.todo('owner can write own files (under 10MB)')
    it.todo('admin can read any user files')
    it.todo('other user cannot read files')
  })

  describe('/agents/{agentId}/**', () => {
    // Read: owner OR admin/director/superadmin. Write: owner (max 25MB)
    it.todo('agent can read own files')
    it.todo('agent can write own files (under 25MB)')
    it.todo('admin can read agent files (receipts included)')
    it.todo('director can read agent files')
    it.todo('superadmin can read agent files')
    it.todo('other agent cannot read files')
  })

  describe('default deny', () => {
    it.todo('any unspecified path is denied')
  })
})
