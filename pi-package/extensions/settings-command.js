/**
 * /vp-knowledge-settings — TUI settings panel.
 *
 * Uses pi-tui's SettingsList for arrow-key navigation, Enter to toggle,
 * Escape to exit. Changes are applied immediately (no draft/save flow).
 */

import { getSettingsListTheme } from '@earendil-works/pi-coding-agent'
// @ts-ignore — pi-tui is a transitive peer dep of pi-coding-agent
import { Container, SettingsList, Text } from '@earendil-works/pi-tui'

import { loadConfig, saveConfig } from './config.js'

/**
 * @param {import('@earendil-works/pi-coding-agent').ExtensionAPI} pi
 * @returns {void}
 */
export function registerSettingsCommand (pi) {
  pi.registerCommand('vp-knowledge-settings', {
    description: 'Configure vp-knowledge-pi extension settings',
    handler: async (_args, ctx) => {
      if (ctx.mode !== 'tui') {
        ctx.ui.notify('/vp-knowledge-settings requires TUI mode', 'error')
        return
      }

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const config = loadConfig()

        /**
         * Build the settings items array. Each item is a toggle with
         * on/off values. We keep section context in the label.
         *
         * @returns {Array<import('@earendil-works/pi-tui').SettingItem>}
         */
        function buildItems () {
          return [
            {
              id: 'agents.autoSync',
              label: 'Auto-sync agent profiles on startup',
              description: 'Copy bundled agents to ~/.pi/agent/agents/ at session start',
              currentValue: config.agents.autoSync ? 'on' : 'off',
              values: ['on', 'off'],
            },
            {
              id: 'qualityChecks.fourthWall',
              label: 'Flag AI self-references',
              description: 'Flag AI self-references in Basic Memory notes',
              currentValue: config.qualityChecks.fourthWall ? 'on' : 'off',
              values: ['on', 'off'],
            },
            {
              id: 'qualityChecks.schemaValidate',
              label: 'Schema validate reminder',
              description: 'Remind to validate notes after BM write/edit',
              currentValue: config.qualityChecks.schemaValidate ? 'on' : 'off',
              values: ['on', 'off'],
            },
            {
              id: 'guidance.auditReminders',
              label: 'Audit sprint reminders',
              description: 'Remind about graph-health audit sprints',
              currentValue: config.guidance.auditReminders ? 'on' : 'off',
              values: ['on', 'off'],
            },
          ]
        }

        /**
         * Apply a toggle change to the in-memory config and persist.
         *
         * @param {string} id
         * @param {string} newValue
         */
        function applyChange (id, newValue) {
          const enabled = newValue === 'on'
          switch (id) {
            case 'agents.autoSync':
              config.agents.autoSync = enabled
              break

            case 'qualityChecks.fourthWall':
              config.qualityChecks.fourthWall = enabled
              break

            case 'qualityChecks.schemaValidate':
              config.qualityChecks.schemaValidate = enabled
              break

            case 'guidance.auditReminders':
              config.guidance.auditReminders = enabled
              // No default
              break
          }
          saveConfig(config)
        }

        const container = new Container()
        container.addChild(new Text(theme.fg('accent', theme.bold('vp-knowledge Settings'))))
        container.addChild(new Text(''))

        const items = buildItems()
        const settingsList = new SettingsList(
          items,
          items.length + 2,
          getSettingsListTheme(),
          /** @type {(id: string, newValue: string) => void} */
          (id, newValue) => {
            applyChange(id, newValue)
            settingsList.updateValue(id, newValue)
            tui.requestRender()
          },
          // eslint-disable-next-line unicorn/no-useless-undefined
          () => done(undefined)
        )
        container.addChild(settingsList)
        container.addChild(new Text(''))
        container.addChild(new Text(theme.fg('dim', '↑↓ navigate • enter toggle • esc exit')))

        return {
          render (width) {
            return container.render(width)
          },
          invalidate () {
            container.invalidate()
          },
          handleInput (data) {
            settingsList.handleInput(data)
            tui.requestRender()
          },
        }
      })
    },
  })
}
