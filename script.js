const SUPABASE_URL = 'https://aoxwtvxavuddykkmlela.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHd0dnhhdnVkZHlra21sZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0OTY0OTgsImV4cCI6MjA2MjA3MjQ5OH0.SXng4P6mo36mMOG1lwoTXjZ4e-p9kfNwzTnqlU2uFUo';


async function fetchEmployees() {
  const response = await fetch(`${SUPABASE_URL}/employees?select=*`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });
  return await response.json();
}

async function fetchAttendance(employeeId, month) {
  const response = await fetch(`${SUPABASE_URL}/attendance?employee_id=eq.${employeeId}&timestamp=gte.${month}-01T00:00:00&timestamp=lte.${month}-31T23:59:59&select=*`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });
  return await response.json();
}

async function fetchMonths() {
  const response = await fetch(`${SUPABASE_URL}/attendance?select=timestamp`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY
    }
  });
  const data = await response.json();
  return [...new Set(data.map(record => record.timestamp.slice(0, 7)))];
}

async function calculateSalary(employeeId, month) {
  const employee = (await fetchEmployees()).find(e => e.id === employeeId);
  const attendance = await fetchAttendance(employeeId, month);
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

  // Calculate OT
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

async function populateEmployeeSelector() {
  const employees = await fetchEmployees();
  const selector = document.getElementById('employee-selector');
  selector.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
  return employees[0]?.id; // Return first employee ID
}

async function populateMonthSelector() {
  const months = await fetchMonths();
  const selector = document.getElementById('month-selector');
  selector.innerHTML = months.map(month => `<option value="${month}">${month}</option>`).join('');
  return months[0] || '2025-05'; // Return first month or default
}

async function displayEmployeeDetails(employeeId) {
  const employee = (await fetchEmployees()).find(e => e.id === employeeId);
  const detailsDiv = document.getElementById('employee-details');
  detailsDiv.innerHTML = `
    <p><strong>Name:</strong> ${employee.name}</p>
    <p><strong>Basic Salary:</strong> NPR ${employee.basic_salary.toFixed(2)}</p>
    <p><strong>Joining Date:</strong> ${employee.joining_date}</p>
  `;
}

async function displayAttendance(employeeId, month) {
  const attendance = await fetchAttendance(employeeId, month);
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

  Object.keys(groupedByDate).sort().forEach(date => {
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
    <p><strong>Basic Salary:</strong> NPR ${salary.basic_salary.toFixed(2)}</p>
    <p><strong>Overtime Hours:</strong> ${salary.ot_hours.toFixed(2)}</p>
    <p><strong>Overtime Pay:</strong> NPR ${salary.ot_pay.toFixed(2)}</p>
    <p><strong>Absences:</strong> ${salary.absences} days</p>
    <p><strong>SSF (Employee):</strong> NPR ${salary.ssf_employee.toFixed(2)}</p>
    <p><strong>SSF (Employer):</strong> NPR ${salary.ssf_employer.toFixed(2)}</p>
    <p><strong>Net Salary:</strong> NPR ${salary.net_salary.toFixed(2)}</p>
  `;
}

async function updatePortal() {
  const employeeId = document.getElementById('employee-selector').value;
  const month = document.getElementById('month-selector').value;
  await displayEmployeeDetails(employeeId);
  await displayAttendance(employeeId, month);
  await displaySalary(employeeId, month);
}

document.getElementById('employee-selector').addEventListener('change', updatePortal);
document.getElementById('month-selector').addEventListener('change', updatePortal);

document.addEventListener('DOMContentLoaded', async () => {
  displayNepaliCalendar();
  const defaultEmployeeId = await populateEmployeeSelector();
  const defaultMonth = await populateMonthSelector();
  if (defaultEmployeeId && defaultMonth) {
    document.getElementById('employee-selector').value = defaultEmployeeId;
    document.getElementById('month-selector').value = defaultMonth;
    await updatePortal();
  }
});
