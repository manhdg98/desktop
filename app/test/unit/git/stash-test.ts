import * as FSE from 'fs-extra'
import * as path from 'path'
import { Repository } from '../../../src/models/repository'
import { setupEmptyRepository } from '../../helpers/repositories'
import { GitProcess } from 'dugite'
import {
  getDesktopStashEntries,
  createDesktopStashMessage,
  createDesktopStashEntry,
  DesktopStashEntryMarker,
} from '../../../src/lib/git/stash'
import { getTipOrError } from '../../helpers/tip'

describe('git/stash', () => {
  describe('getDesktopStashEntries', () => {
    let repository: Repository
    let readme: string

    beforeEach(async () => {
      repository = await setupEmptyRepository()
      readme = path.join(repository.path, 'README.md')
      await FSE.writeFile(readme, '')
      await GitProcess.exec(['add', 'README.md'], repository.path)
      await GitProcess.exec(['commit', '-m', 'initial commit'], repository.path)
    })

    it('handles unborn repo by returning empty list', async () => {
      const repo = await setupEmptyRepository()
      let didFail = false

      try {
        await getDesktopStashEntries(repo)
      } catch (e) {
        didFail = true
      }

      expect(didFail).toBe(true)
    })

    it('returns all stash entries created by Desktop', async () => {
      await generateTestStashEntries(repository)

      const stashEntries = await getDesktopStashEntries(repository)

      expect(stashEntries).toHaveLength(1)
      expect(stashEntries[0].branchName).toBe('master')
    })
  })

  describe('createStashEntry', () => {
    let repository: Repository
    let readme: string

    beforeEach(async () => {
      repository = await setupEmptyRepository()
      readme = path.join(repository.path, 'README.md')
      await FSE.writeFile(readme, '')
      await GitProcess.exec(['add', 'README.md'], repository.path)
      await GitProcess.exec(['commit', '-m', 'initial commit'], repository.path)
    })

    it('creates a stash entry', async () => {
      const branchName = 'master'
      await await FSE.appendFile(readme, 'just testing stuff')
      const tipCommit = await getTipOrError(repository)

      await createDesktopStashEntry(repository, branchName, tipCommit.sha)

      const result = await GitProcess.exec(['stash', 'list'], repository.path)
      const entries = result.stdout.trim().split('\n')
      expect(entries).toHaveLength(1)
      expect(entries[0]).toContain(
        `${DesktopStashEntryMarker}<${branchName}@${tipCommit.sha}`
      )
    })
  })
})

async function stash(repository: Repository, message?: string) {
  const tipCommit = await getTipOrError(repository)
  await GitProcess.exec(
    [
      'stash',
      'push',
      '-m',
      message || createDesktopStashMessage('master', tipCommit.sha),
    ],
    repository.path
  )
}

async function generateTestStashEntries(repository: Repository) {
  const readme = path.join(repository.path, 'README.md')

  // simulate stashing from CLI
  await FSE.appendFile(readme, '1')
  await stash(repository, 'should get filtered')

  await FSE.appendFile(readme, '2')
  await stash(repository, 'should also get filtered')

  // simulate stashing from Desktop
  await FSE.appendFile(readme, '2')
  await stash(repository)
}
