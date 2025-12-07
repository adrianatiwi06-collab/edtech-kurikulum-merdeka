# 🎯 How to Generate 4 TPs for Your Materi

**Issue**: You have 4 important topics but only 3 TPs are generated

**Topic yang Hilang**: "Penggunaan di" (kata depan vs awalan)

---

## ✅ Solution: Use Materi Pokok Field Properly

The system now has **enhanced topic coverage**. When you fill "Materi Pokok", the AI will:
- ✅ Try to cover ALL topics you list
- ✅ Create additional TPs if needed
- ✅ Prioritize complete coverage over "maksimal 4 TP" rule

### How to Use (Step-by-Step):

#### **Step 1: Go to Dashboard**
Navigate to: `/dashboard/buat-tp`

#### **Step 2: Fill Required Fields**
```
Kelas: 1 (Grade 1)
CP Reference: [Your CP text]
Materi Pembelajaran: [Your full learning material]
```

#### **Step 3: IMPORTANT - Fill Materi Pokok Field**
Copy this exactly (all 4 topics):

```
Keselamatan Jalan (4T), Tanda Peringatan/Larangan, Keselamatan Rumah, Penggunaan "di"
```

**Or list them separately**:
```
1. Keselamatan Jalan (konsep 4T menyeberang)
2. Tanda Peringatan dan Larangan
3. Keselamatan di Rumah
4. Penggunaan "di" (kata depan vs awalan)
```

#### **Step 4: Generate**
Click "Generate TP" button and wait

#### **Step 5: Expected Result**
You should now get approximately **4 TPs** covering:
- ✅ TP 1: Keselamatan Jalan (4T) - Menjelaskan cara menyeberang
- ✅ TP 2: Tanda Peringatan/Larangan - Membedakan tanda
- ✅ TP 3: Keselamatan Rumah - Mengidentifikasi bahaya
- ✅ TP 4: Penggunaan "di" - Membedakan kata depan vs awalan **[PREVIOUSLY MISSING]**

---

## 🔧 Technical Improvements Made

### What Changed in the System:

**1. Enhanced Materi Pokok Instructions** (in prompt)
```
"Prioritaskan SEMUA topik ini dalam pembuatan TP - jangan ada yang terlewat!"
```

**2. New Validation Rule** (in self-check)
```
✓ Fokus Materi Pokok:
  - Apakah SEMUA topik tercakup?
  - Jangan ada topik yang terlewat!
  - Jika ada topik terlewat → TAMBAHKAN TP baru
  - Cakupan topik LEBIH PENTING daripada "maksimal 4 TP"
```

**3. Priority Rule**
```
JIKA PERLU > 4 TP UNTUK COVER SEMUA TOPIK → BUAT SAMPAI SEMUA TERCAKUP
```

---

## 📊 Your Specific Case

### Your Topics (4 items):
1. **Keselamatan Jalan: Konsep "4T" saat menyeberang**
   - Keranjang: A (Pengetahuan Inti)
   - Expected KKO: Menjelaskan, Memahami

2. **Membedakan tanda peringatan & larangan**
   - Keranjang: B (Teknis & Struktural)
   - Expected KKO: Membedakan, Mengidentifikasi

3. **Keselamatan di Rumah**
   - Keranjang: C (Aplikasi & Keterampilan)
   - Expected KKO: Mengidentifikasi, Mempraktikkan

4. **Penggunaan "di" (kata depan vs awalan)**
   - Keranjang: A (Pengetahuan Inti - Bahasa)
   - Expected KKO: Membedakan, Mengklasifikasi
   - **Note**: This is separate topic area, needs own TP

### Why It Was Skipped Before:
- The AI was using 3-keranjang methodology
- "Penggunaan di" was seen as secondary to road safety topics
- Only 3 TPs were generated for the primary theme
- **Solution**: Explicit materi pokok listing forces inclusion

---

## 🧪 Testing Instructions

### Test 1: WITH Materi Pokok (Should get 4 TPs)
1. Fill "Materi Pokok" field with all 4 topics
2. Generate TP
3. **Expected**: 4 TPs including "Penggunaan di"

### Test 2: WITHOUT Materi Pokok (Baseline)
1. Leave "Materi Pokok" empty
2. Generate TP
3. **Expected**: 3 TPs (safety-focused) - this is OK

### Test 3: Verify Topic Coverage
Check each generated TP:
- [ ] Road safety (4T) covered?
- [ ] Traffic signs covered?
- [ ] Home safety covered?
- [ ] "di" usage covered?

---

## 💡 Best Practices

### DO:
✅ List ALL important topics in Materi Pokok  
✅ Separate topics with commas or numbers  
✅ Be specific: "Penggunaan di" not just "di"  
✅ Keep topics brief but clear  

### DON'T:
❌ Leave Materi Pokok empty when you have multiple topics  
❌ Mix unrelated topics in one line  
❌ Use ambiguous terms  
❌ Assume AI will magically find all topics  

---

## 📋 Format Examples

### Example 1: Comma-Separated
```
Keselamatan Jalan (4T), Tanda Peringatan/Larangan, Keselamatan Rumah, Penggunaan "di"
```

### Example 2: Numbered
```
1. Konsep 4T Menyeberang Jalan
2. Tanda Peringatan & Larangan
3. Keselamatan Rumah & Bahaya
4. Penggunaan "di" Sebagai Kata Depan & Awalan
```

### Example 3: Descriptive
```
Safety topics: Road (4T concept), Traffic signs, Home safety; Language: "di" usage (preposition vs prefix)
```

---

## ❓ FAQ

**Q: Will it always generate 4 TPs if I list 4 topics?**  
A: Yes, the system now prioritizes complete topic coverage over the "maksimal 4" rule.

**Q: Can I exceed 4 TPs?**  
A: Yes, if you have 5+ important topics, the system will create TPs for all of them.

**Q: What if some TPs are redundant?**  
A: The self-validation checklist will catch this and consolidate them.

**Q: Can I use this for other subjects?**  
A: Absolutely! Works for any subject and grade level.

**Q: What if I'm still only getting 3?**  
A: Try being more specific in Materi Pokok (e.g., add more context).

---

## 🚀 Next Steps

1. **Try the new system** with your Materi Pokok:
   ```
   Keselamatan Jalan (4T), Tanda Peringatan/Larangan, Keselamatan Rumah, Penggunaan "di"
   ```

2. **Document the result**: Save the generated TPs

3. **Give feedback**: Are all 4 topics now covered?

4. **Report any issues**: If a topic is still missing, let me know which one

---

**Status**: ✅ Enhanced  
**Effective**: Immediately after restart  
**Backward Compatible**: Yes (works with or without Materi Pokok)
