Auto-Delimiter Detection

TestData1
results = [
  
  {delimt: '\t', counts: [ 0 , 0 , 0 , 0 , 0], minCount: 0, maxCount: 0, isConsistent: false} , 
  {delimt: ';', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true} , 
  {delimt: ',', counts: [ 0 , 3 , 3 , 3 , 3], minCount: 0, maxCount: 3, isConsistent: false}
  
  ]

delim = '\t' => counts = [ 0 , 0 , 0 , 0 , 0]
minCount = 0
maxCount = 0
isConsistent = false

delim = ';' => counts = [ 3 , 3 , 3 , 3 , 3]
minCount = 3
maxCount = 3
isConsistent = true

delim = ',' => counts = [ 0 , 3 , 3 , 3 , 3]
minCount = 0
maxCount = 3
isConsistent = false

consistent = [
  {delimt: ';', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true}
  ]

----
TestData2

results = [
  
  {delimt: '\t', counts: [ 0 , 0 , 0 , 0 , 0], minCount: 0, maxCount: 0, isConsistent: false} , 
  {delimt: ';', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true} , 
  {delimt: ',', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true}
  
  ]

consistent = [
  {delimt: ';', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true} , 
  {delimt: ',', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true}
]


---
TestData3
results = [
  
  {delimt: '\t', counts: [ 0 , 0 , 0 , 0 , 0], minCount: 0, maxCount: 0, isConsistent: false} , 
  {delimt: ';', counts: [ 0 , 0 , 0 , 0 , 0], minCount: 0, maxCount: 0, isConsistent: false} , 
  {delimt: ',', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true} 
  
  ]


consistent = [
  {delimt: ',', counts: [ 3 , 3 , 3 , 3 , 3], minCount: 3, maxCount: 3, isConsistent: true}
]

FIRST CHOICE CONDITION => available consistent delimiters.

SECOND CHOICE CONDITION => without consistent delimiters:
  (IDENTIFY SMALLER VARIANCE DELIMITER)

  Only check for multiple inconsistent delim with minCount>0
withCounts = [
  a = {delimt: '\t', counts: [ 3 , 2 , 3 , 4 , 3], minCount:2 , maxCount:3, isConsistent: false}, 
  b = {delimt: ';', counts: [ 3 , 3 , 2 , 3 , 3], minCount: 3, maxCount: 4, isConsistent: false}
]
  \t = [3,2,3,4,3] minCount = 3
  ; = [3,3,2,3,3] minCount > 0 (1)
  , = [0,1,0,0,2] minCount = 0

if variance between a,b is not equal => return delim of object with 'less variance'.

if variance is tied between a,b => return delim of object with highest 'minCount'.

  sort (a,b) = -ve => a is first (0th index)
  sort (a,b) = +ve => b is first (0th index)

FALLBACK = ','

---
---

## Decimal Separator

if delimiter === ';' => ,
else => .

## Detect Header

1) If commentHeaderLine is true,
    =>headerNames = stript (#), split with delim, remove spaces with trim 
        eg: headerNames = ['refnr','A','B']
      rowNames = dataLines
2) Else: (no commentHeaderLine):
      detect if first data line is the headerline
      run detectHeader()

        If detectHeader() = true 
          headerNames = datalines[0].split...
          rowNames = datalines.slice(1)

        Else:
          Generate header names
          rowNames = datalines

  
--- 
DETECT HEADER(candidateLine, dataLines, delim, deSep)

isNumeric() => finds if a cell/string is numeric

candidateCells = candidateLine.split
candidateNumericCells = count of number of numeric cells in within candidate cells array using isNumeric function

const candidateRatio =
    candidateCells.length > 0
      ? candidateNumericCount / candidateCells.length
      : 0;
  const dataRatio = totalDataCells > 0 ? totalDataNumeric / totalDataCells : 0;


if (dataRatio > 0.5 && candidateRatio < 0.5) return true;

// First row is similarly numeric to data → not a header (it's data)
if (candidateRatio >= 0.5) return false;

// Both non-numeric (all strings) → default: treat first row as header
return true;

##  Parse

- 3 exceptional Cases that we need to check before converting String to Number while parsing
some values in the csv file can contain:
 - Empty value => return null to the cell in the row in rows
 - String instead of a value => return actual string to the cell in the rows instead of garbage

(numeric value => return numeric value)

this should not crash the system