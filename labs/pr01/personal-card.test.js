import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

import { expect, it } from 'vitest';

const APP_PATH = resolve(process.cwd(), 'pr01-personal-card', 'app.js');

function runStudentApp() {
  const calls = [];
  const context = {
    renderProfile(profile) {
      calls.push(profile);
    },
  };

  vm.createContext(context);
  const source = readFileSync(APP_PATH, 'utf8');
  vm.runInContext(`${source}\n;globalThis.__gradedProfile = profile;`, context, {
    filename: APP_PATH,
  });

  return { profile: context.__gradedProfile, calls };
}

function profileHasTodo(profile) {
  return Object.values(profile).some(
    (value) => typeof value === 'string' && value.toUpperCase().includes('TODO'),
  );
}

it('personal names are non-empty and contain no TODO', () => {
    const { profile } = runStudentApp();

    expect(profile.firstName).toEqual(expect.any(String));
    expect(profile.lastName).toEqual(expect.any(String));
    expect(profile.firstName.trim().length).toBeGreaterThan(0);
    expect(profile.lastName.trim().length).toBeGreaterThan(0);
    expect(`${profile.firstName} ${profile.lastName}`.toUpperCase()).not.toContain('TODO');
});

it('group is one of the documented P-24 groups', () => {
    const { profile } = runStudentApp();

    expect(['1P-24', '2P-24']).toContain(profile.group);
});

it('fullName combines firstName and lastName', () => {
    const { profile } = runStudentApp();

    expect(profile.fullName).toEqual(expect.any(String));
    expect(profile.fullName).toContain(profile.firstName);
    expect(profile.fullName).toContain(profile.lastName);
    expect(profile.fullName.toUpperCase()).not.toContain('TODO');
});

it('specialty is a non-empty value', () => {
    const { profile } = runStudentApp();

    expect(profile.specialty).toEqual(expect.any(String));
    expect(profile.specialty.trim().length).toBeGreaterThan(0);
    expect(profile.specialty.toUpperCase()).not.toContain('TODO');
});

it('weeklyHours is a realistic finite number', () => {
    const { profile } = runStudentApp();

    expect(Number.isFinite(profile.weeklyHours)).toBe(true);
    expect(profile.weeklyHours).toBeGreaterThanOrEqual(1);
    expect(profile.weeklyHours).toBeLessThanOrEqual(40);
});

it('semester workload is calculated from 15 weeks', () => {
    const { profile } = runStudentApp();

    expect(profile.semesterWeeks).toBe(15);
    expect(profile.semesterHours).toBe(profile.weeklyHours * profile.semesterWeeks);
});

it('intro contains the generated profile details', () => {
    const { profile } = runStudentApp();

    expect(profile.intro).toEqual(expect.any(String));
    expect(profile.intro).toContain(profile.fullName);
    expect(profile.intro).toContain(profile.group);
    expect(profile.intro).toContain(profile.specialty);
    expect(profileHasTodo(profile)).toBe(false);
});

it('renderProfile receives the profile exactly once', () => {
    const { profile, calls } = runStudentApp();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(profile);
});
