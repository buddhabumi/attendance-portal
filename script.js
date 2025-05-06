const SUPABASE_URL = 'https://aoxwtvxavuddykkmlela.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveHd0dnhhdnVkZHlra21sZWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY0OTY0OTgsImV4cCI6MjA2MjA3MjQ5OH0.SXng4P6mo36mMOG1lwoTXjZ4e-p9kfNwzTnqlU2uFUo';

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearError() {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

async function fetchEmployees() {
  try {
    const response = await fetch(`${SUPABASE_URL}/employees?select=*`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    console.log('Fetched employees:', data);
    return data;
  } catch (error) {
    showError(`Failed to fetch employees: ${error.message}`);
    console.error('Fetch employees error:', error);
    return [];
  }
}

async function fetchAttendance(employeeId, month) {
  try {
    const url = `${SUPABASE_URL}/attendance?employee_id=eq.${encodeURIComponent(employeeId)}×tamp=gte.${month}-01T00:00:00+05:45×tamp=lte.${month}-31T23:59:59+05:45&select=*&order=timestamp.asc`;
    console.log('Fetching attendance with URL:', url);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    console.log('Fetched attendance:', data);
    if (!data || data.length === 0) {
      console.log('No attendance records returned for employee:', employeeId, 'month:', month);
    }
    return data;
  } catch (error) {
    showError(`Failed to fetch attendance: ${error.message}`);
    console.error('Fetch attendance error:', error);
    return [];
  }
}

async function calculateSalary(employeeId, month) {
  const employee = (await fetchEmployees()).find(e => e.id === employeeId);
  if (!employee) {
    showError('Employee not found');
    return null;
  }
  const attendance = await fetchAttendance(employeeId, month);
  const workingDays = 26;
  let otHours = 0;
  let absences = 0;
  const dailyHours = 8;
  const hourlyRate = employee.basic_salary / (workingDays * dailyHours);

  const attendanceByDate = {};
  attendance.forEach(record => {
    const date = record.timestamp.split('T')[0];
    if (!attendanceByDate[date]) {
      attendanceByDate[date] = [];
    }
    attendanceByDate[date].push(record);
  });

  Object.keys(attendanceByDate).forEach(date => {
    const records = attendanceByDate[date];
    if (records.length >= 2) {
      const inTime = new Date(records.find(r => r.status === 'IN')?.timestamp);
      const outTime = new Date(records.find(r => r.status === 'OUT')?.timestamp);
      if (inTime && outTime) {
        const hoursWorked = (outTime - inTime) / (1000 * 60 * 60);
        if (hoursWorked > dailyHours) {
          otHours += hoursWorked - dailyHours;
        }
      }
    }
  });

  absences = workingDays - Object.keys(attendanceByDate).length;

  const otPay = otHours * hourlyRate * 1.5;
  const ssfEmployee = employee.basic_salary * 0.11;
  const ssfEmployer = employee.basic_salary * 0.20;
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
  try {
    const today = new NepaliDate();
    const calendarDiv = document.getElementById('calendar');
    calendarDiv.innerHTML = `<p>Today's Date (Nepali): ${today.format('YYYY-MM-DD')}</p>`;
  } catch (error) {
    showError('Failed to load Nepali calendar');
    console.error('Nepali calendar error:', error);
  }
}

async function populateEmployeeSelector() {
  const employees = await fetchEmployees();
  const selector = document.getElementById('employee-selector');
  selector.innerHTML = employees.length
    ? employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('')
    : '<option value="">No employees found</option>';
  return employees[0]?.id;
}

async function displayEmployeeDetails(employeeId) {
  try {
    const employee = (await fetchEmployees()).find(e => e.id === employeeId);
    const detailsDiv = document.getElementById('employee-details');
    if (employee) {
      detailsDiv.innerHTML = `
        <p><strong>Name:</strong> ${employee.name}</p>
        <p><strong>Basic Salary:</strong> NPR ${employee.basic_salary.toFixed(2)}</p>
        <p><strong>Joining Date:</strong> ${employee.joining_date}</p>
      `;
    } else {
      detailsDiv.innerHTML = '<p>Employee not found</p>';
    }
  } catch (error) {
    showError('Failed to load employee details');
    console.error('Employee details error:', error);
  }
}

async function displayAttendance(employeeId, month) {
  try {
    clearError();
    const attendance = await fetchAttendance(employeeId, month);
    const tableBody = document.querySelector('#attendance-table tbody');
    tableBody.innerHTML = '';

    console.log('Rendering attendance for:', employeeId, month, 'Records:', attendance);

    if (!attendance || attendance.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="3">No attendance records found</td></tr>';
      return;
    }

    const groupedByDate = {};
    attendance.forEach(record => {
      console.log('Processing record:', record);
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

    console.log('Grouped attendance by date:', groupedByDate);

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
  } catch (error) {
    showError(`Failed to display attendance: ${error.message}`);
    console.error('Display attendance error:', error);
  }
}

async function displaySalary(employeeId, month) {
  try {
    clearError();
    const salary = await calculateSalary(employeeId, month);
    const salaryDiv = document.getElementById('salary-details');
    if (salary) {
      salaryDiv.innerHTML = `
        <p><strong>Basic Salary:</strong> NPR ${salary.basic_salary.toFixed(2)}</p>
        <p><strong>Overtime Hours:</strong> ${salary.ot_hours.toFixed(2)}</p>
        <p><strong>Overtime Pay:</strong> NPR ${salary.ot_pay.toFixed(2)}</p>
        <p><strong>Absences:</strong> ${salary.absences} days</p>
        <p><strong>SSF (Employee):</strong> NPR ${salary.ssf_employee.toFixed(2)}</p>
        <p><strong>SSF (Employer):</strong> NPR ${salary.ssf_employer.toFixed(2)}</p>
        <p><strong>Net Salary:</strong> NPR ${salary.net_salary.toFixed(2)}</p>
      `;
    } else {
      salaryDiv.innerHTML = '<p>Salary calculation failed</p>';
    }
  } catch (error) {
    showError('Failed to load salary details');
    console.error('Salary display error:', error);
  }
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
  if (defaultEmployeeId) {
    document.getElementById('employee-selector').value = defaultEmployeeId;
    document.getElementById('month-selector').value = '2025-05';
    await updatePortal();
  }
});
