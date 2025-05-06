const SUPABASE_URL = 'https://your-project-id.supabase.co/rest/v1';
const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';

async function fetchAttendance(month) {
  const response = await fetch(`${SUPABASE_URL}/attendance?select=*&timestamp=gte.${month}-01T00:00:00&timestamp=lte.${month}-31T23:59:59`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });
  return await response.json();
}

async function fetchEmployee(employeeId) {
  const response = await fetch(`${SUPABASE_URL}/employees?id=eq.${employeeId}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });
  const data = await response.json();
  return data[0];
}

async function calculateSalary(employeeId, month) {
  const employee = await fetchEmployee(employeeId);
  const attendance = await fetchAttendance(month);
  const workingDays = 26; // Assume 26 working days per month
  let otHours = 0;
  let absences = 0;
  const dailyHours = 8;
  const hourlyRate = employee.basic_salary / (workingDays * dailyHours);

  // Group attendance by date
  const attendanceByDate = {};
  attendance.forEach(record => {
    const date = record.timestamp.split('T')[0];
    if (!attendanceByDate[date]) {
      attendanceByDate[date] = [];
    }
    attendanceByDate[date].push(record);
  });

  // Calculate OT and absences
  Object.keys(attendanceByDate).forEach(date => {
    const records = attendanceByDate[date];
    if (records.length === 2) {
      const inTime = new Date(records.find(r => r.status === 'IN').timestamp);
      const outTime = new Date(records.find(r => r.status === 'OUT').timestamp);
      const hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
      if (hoursWorked > dailyHours) {
        otHours += hoursWorked - dailyHours;
      }
    }
  });

  // Calculate absences
  absences = workingDays - Object.keys(attendanceByDate).length;

  // Salary calculations
  const otPay = otHours * hourlyRate * 1.5;
  const ssfEmployee = employee.basic_salary * 0.11; // 11% employee SSF
  const ssfEmployer = employee.basic_salary * 0.20; // 20% employer SSF
  const absenceDeduction = (employee.basic_salary / workingDays) * absences;
  const netSalary = employee.basic_salary + otPay - absenceDeduction - ssfEmployee;

  return {
    basic_salary: employee.basic_salary,
    ot_hours: otHours,
    ot_pay: otPay,
    absences,
    ssf_employee: ssfEmployee,
    ssf_employer: ssfEmployer,
    net_salary: netSalary
  };
}

function displayNepaliCalendar() {
  const today = new NepaliDate();
  const calendarDiv = document.getElementById('calendar');
  calendarDiv.innerHTML = `<p>Today's Date (Nepali): ${today.format('YYYY-MM-DD')}</p>`;
}

async function displayAttendance(month) {
  const attendance = await fetchAttendance(month);
  const tableBody = document.querySelector('#attendance-table tbody');
  tableBody.innerHTML = '';

  const groupedByDate = {};
  attendance.forEach(record => {
    const date = record.timestamp.split('T')[0];
    if (!groupedByDate[date]) {
      groupedByDate[date] = { in: null, out: null };
    }
    if (record.status === 'IN') {
      groupedByDate[date].in = record.timestamp;
    } else if (record.status === 'OUT') {
      groupedByDate[date].out = record.timestamp;
    }
  });

  Object.keys(groupedByDate).forEach(date => {
    const record = groupedByDate[date];
    const nepaliDate = new NepaliDate(new Date(date));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${nepaliDate.format('YYYY-MM-DD')}</td>
      <td>${record.in ? record.in.split('T')[1].split('+')[0] : '-'}</td>
      <td>${record.out ? record.out.split('T')[1].split('+')[0] : '-'}</td>
    `;
    tableBody.appendChild(row);
  });
}

async function displaySalary(employeeId, month) {
  const salary = await calculateSalary(employeeId, month);
  const salaryDiv = document.getElementById('salary-details');
  salaryDiv.innerHTML = `
    <p>Basic Salary: NPR ${salary.basic_salary.toFixed(2)}</p>
    <p>Overtime Hours: ${salary.ot_hours.toFixed(2)}</p>
    <p>Overtime Pay: NPR ${salary.ot_pay.toFixed(2)}</p>
    <p>Absences: ${salary.absences} days</p>
    <p>SSF (Employee): NPR ${salary.ssf_employee.toFixed(2)}</p>
    <p>SSF (Employer): NPR ${salary.ssf_employer.toFixed(2)}</p>
    <p>Net Salary: NPR ${salary.net_salary.toFixed(2)}</p>
  `;
}

document.getElementById('month-selector').addEventListener('change', (e) => {
  const month = e.target.value;
  displayAttendance(month);
  displaySalary('EMP001', month);
});

document.addEventListener('DOMContentLoaded', () => {
  displayNepaliCalendar();
  const defaultMonth = '2025-05';
  displayAttendance(defaultMonth);
  displaySalary('EMP001', defaultMonth);
});
