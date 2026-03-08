import { createDefaultDoctorOptions } from './options.mjs';
import { runDoctorSuite } from '../doctor/aggregate.mjs';

export function normalizeDoctorOptions(rawOptions = {}) {
  const defaults = createDefaultDoctorOptions();
  return {
    strict: Boolean(rawOptions.strict ?? defaults.strict),
    globalSecurity: Boolean(rawOptions.globalSecurity ?? defaults.globalSecurity),
  };
}

export function planDoctor(rawOptions = {}) {
  const options = normalizeDoctorOptions(rawOptions);
  const args = ['doctor'];
  if (options.strict) args.push('--strict');
  if (options.globalSecurity) args.push('--global-security');
  return {
    command: 'doctor',
    options,
    preview: `node scripts/aios.mjs ${args.join(' ')}`,
  };
}

export async function runDoctor(rawOptions = {}, { rootDir, io = console } = {}) {
  const { options } = planDoctor(rawOptions);
  const result = await runDoctorSuite({ rootDir, ...options, io });
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}
