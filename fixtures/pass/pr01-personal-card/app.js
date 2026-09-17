'use strict';

const firstName = 'Marta';
const lastName = 'Kovalenko';
const group = '1P-24';
const specialty = 'Software Engineering';
const weeklyHours = 6;
const semesterWeeks = 15;
const fullName = `${firstName} ${lastName}`;
const semesterHours = weeklyHours * semesterWeeks;
const intro = `${fullName} studies ${specialty} in group ${group}.`;

const profile = {
  firstName,
  lastName,
  fullName,
  group,
  specialty,
  weeklyHours,
  semesterWeeks,
  semesterHours,
  intro,
};

renderProfile(profile);
