import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWakeUpTime,
  classifySleepTime,
  classifyPrayerTime,
  classifyTriSandhyaTime,
  classifyMealTime
} from './timeClassifier';

test('classifyWakeUpTime mengikuti Spesifikasi Final Section 3 (75/70/65/60/55/50)', () => {
  assert.equal(classifyWakeUpTime('04.00-04.20').points, 75);
  assert.equal(classifyWakeUpTime('04.21-04.40').points, 70);
  assert.equal(classifyWakeUpTime('04.41-05.00').points, 65);
  assert.equal(classifyWakeUpTime('05.01-06.20').points, 60);
  assert.equal(classifyWakeUpTime('06.21-06.40').points, 55);
  assert.equal(classifyWakeUpTime('>06.40').points, 50);
});

test('classifySleepTime mengikuti Spesifikasi Final Section 5 (75/65/55/45)', () => {
  assert.equal(classifySleepTime('<21.30').points, 75);
  assert.equal(classifySleepTime('21.30-22.30').points, 65);
  assert.equal(classifySleepTime('22.31-23.30').points, 55);
  assert.equal(classifySleepTime('>23.30').points, 45);
});

test('classifyPrayerTime mengunci shalat yang belum masuk jadwal hari ini', () => {
  const locked = classifyPrayerTime('isya', 'awal', undefined, false, '15:00');
  assert.equal(locked.canSubmit, false);
  assert.equal(locked.status, 'TERKUNCI');

  const unlocked = classifyPrayerTime('subuh', 'awal', undefined, false, '06:00');
  assert.equal(unlocked.canSubmit, true);
  assert.equal(unlocked.points, 100);
});

test('classifyTriSandhyaTime mengunci sesi sebelum jadwal dan menilai 100/85/70', () => {
  const lockedSore = classifyTriSandhyaTime('sore', 'awal', '18:00', false, '14:00');
  assert.equal(lockedSore.canSubmit, false);

  const unlockedPagi = classifyTriSandhyaTime('pagi', 'tengah', '06:00', true);
  assert.equal(unlockedPagi.canSubmit, true);
  assert.equal(unlockedPagi.points, 85);
});

test('classifyMealTime memberikan 15 poin pada rentang ideal dan 10 poin di luar ideal', () => {
  assert.equal(classifyMealTime('pagi', '07:00').points, 15);
  assert.equal(classifyMealTime('pagi', '09:30').points, 10);
});
