# Testing Guide - EdTech Kurikulum Merdeka

## 🧪 Manual Testing Checklist

### Pre-Testing Setup
- [ ] Development server running (`npm run dev`)
- [ ] Firebase project configured
- [ ] Gemini API key active
- [ ] Browser console open (F12)

---

## 1. Authentication Testing

### Test Case 1.1: User Registration
**Steps:**
1. Navigate to `/login`
2. Click "Belum punya akun? Daftar"
3. Fill in:
   - Nama: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
4. Click "Daftar"

**Expected:**
- ✅ Redirect to dashboard
- ✅ User email shown in sidebar
- ✅ No console errors

### Test Case 1.2: User Login
**Steps:**
1. Logout from dashboard
2. Go to `/login`
3. Enter email & password
4. Click "Login"

**Expected:**
- ✅ Redirect to dashboard
- ✅ Session persisted (refresh page stays logged in)

### Test Case 1.3: Protected Routes
**Steps:**
1. Logout
2. Try to access `/dashboard` directly

**Expected:**
- ✅ Redirect to `/login`
- ✅ Cannot access protected pages

---

## 2. Master Data Testing

### Test Case 2.1: Create Class
**Steps:**
1. Go to Master Data
2. Click "Tambah Kelas"
3. Fill:
   - Nama Kelas: "7A"
   - Tingkat: "7"
4. Click "Simpan"

**Expected:**
- ✅ Class appears in list
- ✅ Can click to select
- ✅ Data saved in Firestore

### Test Case 2.2: Add Students
**Steps:**
1. Select class "7A"
2. Click "Tambah Siswa"
3. Fill:
   - Nama: "Ahmad Rizky"
   - NISN: "1234567890"
4. Click "Simpan"
5. Repeat for 3-5 students

**Expected:**
- ✅ Students appear in table
- ✅ Sequential numbering
- ✅ Edit/Delete buttons work

### Test Case 2.3: Edit & Delete
**Steps:**
1. Click edit on a student
2. Change name
3. Click "Update"
4. Click delete on another student
5. Confirm deletion

**Expected:**
- ✅ Changes reflected immediately
- ✅ Confirmation dialog shows
- ✅ Student removed from list

---

## 3. Generate TP Testing

### Test Case 3.1: Text Input Method
**Steps:**
1. Go to Generate TP
2. Select "Input Teks"
3. Fill:
   - Kelas: "7"
   - CP Reference: "Siswa mampu..."
   - Teks Materi: (Paste long text about a subject)
4. Click "Generate Tujuan Pembelajaran"

**Expected:**
- ✅ Loading indicator shows
- ✅ Wait 10-30 seconds
- ✅ TPs appear in Semester 1 & 2 tables
- ✅ All TPs are checked by default

### Test Case 3.2: Review & Edit TP
**Steps:**
1. Uncheck 2-3 TPs
2. Click edit on a chapter name
3. Change chapter name
4. Save
5. Click edit on a TP text
6. Modify TP
7. Save

**Expected:**
- ✅ Checkboxes toggle correctly
- ✅ Edits apply immediately
- ✅ UI updates without refresh

### Test Case 3.3: Save TP
**Steps:**
1. Keep 5-10 TPs checked
2. Click "Simpan TP Terpilih"

**Expected:**
- ✅ Success alert shown
- ✅ Data saved to Firestore
- ✅ Form resets
- ✅ Can generate again

### Test Case 3.4: PDF Upload Method
**Steps:**
1. Go back to Generate TP
2. Select "Upload PDF"
3. Upload a sample PDF file
4. Fill other fields
5. Generate

**Expected:**
- ✅ PDF uploads successfully
- ✅ Text extracted
- ✅ TPs generated from PDF content

---

## 4. Generate Soal Testing

### Test Case 4.1: Select TPs
**Steps:**
1. Go to Generate Soal
2. Check TP selection list appears
3. Select 3-5 TPs from different chapters

**Expected:**
- ✅ TPs grouped by chapter
- ✅ Semester & grade info shown
- ✅ Can select/deselect

### Test Case 4.2: Configure Questions
**Steps:**
1. Fill configuration:
   - Mata Pelajaran: "Matematika"
   - Judul Ujian: "Ulangan Harian Bab 1"
   - Waktu: 60
   - PG: 10 soal, bobot 1
   - Essay: 5 soal, bobot 2
2. Check "Sertakan teks TP"
3. Click "Generate Soal"

**Expected:**
- ✅ Loading indicator shows
- ✅ Questions generated (wait ~20s)
- ✅ Preview shows all questions
- ✅ PG has options A-E
- ✅ Correct answers marked green in preview

### Test Case 4.3: Export to Word
**Steps:**
1. Click "Download Soal (.docx)"
2. Open downloaded file
3. Click "Download Kunci Jawaban (.docx)"
4. Open downloaded file

**Expected:**
- ✅ Both files download
- ✅ Soal file has questions formatted
- ✅ Kunci file has answers
- ✅ TP texts included if checked
- ✅ No formatting errors

---

## 5. Koreksi Digital Testing

### Test Case 5.1: Select Exam & Class
**Steps:**
1. Go to Koreksi Digital
2. Select "Matematika"
3. Select the question bank created earlier
4. Enter exam name: "UH 1 - Januari 2024"
5. Select class "7A"
6. Click "Mulai Koreksi"

**Expected:**
- ✅ Question banks filtered by subject
- ✅ Class dropdown shows created classes
- ✅ Students count shown
- ✅ Proceeds to grading table

### Test Case 5.2: Input PG Answers
**Steps:**
1. In first student row, input PG answers:
   - Q1: A
   - Q2: B
   - Q3: A (test with correct answer)
   - Q4: D (test with wrong answer)
2. Observe cell colors
3. Try Tab key to move between cells

**Expected:**
- ✅ Auto-tab works after 1 character
- ✅ Green for correct, red for wrong
- ✅ Only accepts A-E
- ✅ Total score updates

### Test Case 5.3: Input Essay Scores
**Steps:**
1. Input essay scores for same student
2. Try entering score > max weight
3. Try entering negative number
4. Enter valid scores

**Expected:**
- ✅ Validates max score
- ✅ Rejects negative numbers
- ✅ Total score updates
- ✅ Calculation is correct

### Test Case 5.4: Handle Absent Students
**Steps:**
1. Leave some cells empty (simulate absent)
2. Move to next student

**Expected:**
- ✅ Empty cells have no color
- ✅ Score calculated as 0 for empty
- ✅ No errors

### Test Case 5.5: Save & Finalize
**Steps:**
1. Complete grades for 3-5 students
2. Click "Simpan"
3. Click "Finalisasi"
4. Confirm
5. Try to edit a cell

**Expected:**
- ✅ Save success message
- ✅ Finalization confirmation dialog
- ✅ "Finalized" badge appears
- ✅ All inputs become read-only
- ✅ Can unlock if needed

---

## 6. Rekap Nilai Testing

### Test Case 6.1: View Grades
**Steps:**
1. Go to Rekap Nilai
2. Observe the grades list

**Expected:**
- ✅ Previously saved grades appear
- ✅ Shows subject, class, date
- ✅ Statistics calculated (avg, max, min)
- ✅ Finalized badge visible

### Test Case 6.2: Filter & Sort
**Steps:**
1. Select subject filter: "Matematika"
2. Select class filter: "7A"
3. Change sort to "Nama Ujian"
4. Change order to "Terlama"

**Expected:**
- ✅ Results filtered correctly
- ✅ Sorting works
- ✅ No duplicates

### Test Case 6.3: Export CSV
**Steps:**
1. Click "Export CSV" on a grade entry
2. Open downloaded CSV file in Excel/Sheets

**Expected:**
- ✅ File downloads
- ✅ Contains: No, Nama, Nilai
- ✅ Data matches display
- ✅ Proper CSV format

### Test Case 6.4: Pagination
**Steps:**
1. If > 10 grades, test pagination
2. Click "Selanjutnya"
3. Click "Sebelumnya"

**Expected:**
- ✅ Shows 10 items per page
- ✅ Navigation buttons work
- ✅ Page number updates

---

## 7. Edge Cases & Error Handling

### Test Case 7.1: Network Errors
**Steps:**
1. Disconnect internet
2. Try any operation
3. Reconnect

**Expected:**
- ✅ Error message shown
- ✅ No crash
- ✅ Can retry when reconnected

### Test Case 7.2: Invalid Inputs
**Steps:**
1. Try invalid class name (symbols, empty)
2. Try invalid NISN (letters)
3. Try negative numbers in configs

**Expected:**
- ✅ Validation prevents submission
- ✅ Error messages clear
- ✅ No data corruption

### Test Case 7.3: Gemini API Failure
**Steps:**
1. Use invalid/expired API key
2. Try generate TP or Soal

**Expected:**
- ✅ Error message displayed
- ✅ Suggests checking API key
- ✅ No partial data saved

### Test Case 7.4: Concurrent Edits
**Steps:**
1. Open app in 2 browser tabs
2. Edit same data in both
3. Save from both

**Expected:**
- ✅ Last save wins (expected behavior)
- ✅ No data corruption
- ✅ Might need refresh to see updates

---

## 8. Performance Testing

### Test Case 8.1: Large Dataset
**Steps:**
1. Create 5 classes
2. Add 30 students per class
3. Generate 10 TP sets
4. Create 10 question banks

**Expected:**
- ✅ UI remains responsive
- ✅ Queries complete < 2s
- ✅ No memory leaks

### Test Case 8.2: Large Text Processing
**Steps:**
1. Input 10,000+ character text
2. Generate TP

**Expected:**
- ✅ Text chunking works
- ✅ Multiple Gemini calls made
- ✅ Results merged correctly

---

## 9. Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Expected:**
- ✅ Consistent UI
- ✅ All features work
- ✅ No console errors

---

## 10. Mobile Responsiveness

### Test Case 10.1: Mobile View
**Steps:**
1. Open on mobile device or DevTools mobile view
2. Test all pages

**Expected:**
- ✅ Sidebar collapses or adapts
- ✅ Tables scroll horizontally
- ✅ Buttons are tappable
- ✅ Forms are usable

---

## 🐛 Bug Report Template

When you find a bug:

```markdown
**Title**: [Brief description]

**Steps to Reproduce**:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Screenshots**:
[If applicable]

**Environment**:
- Browser: Chrome 120
- OS: Windows 11
- Account: test@example.com
```

---

## ✅ Sign-off Checklist

Before declaring "ready for production":

- [ ] All test cases passed
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Mobile responsive
- [ ] All exports work
- [ ] Data persisted correctly
- [ ] Security rules working
- [ ] Error handling graceful
- [ ] Documentation updated
- [ ] Code reviewed

---

**Happy Testing! 🧪**
