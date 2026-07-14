import pino, { Logger } from 'pino'

export type AppLogger = Logger

export function createLogger(service: string): AppLogger {
  const isDev = process.env.NODE_ENV !== 'production'
  return pino({
    level: isDev ? 'debug' : 'info',
    ...(isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    }),
    base: { service },
  })
}
