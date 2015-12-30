# arff-utils

a package for creating [arff](https://weka.wikispaces.com/ARFF) files for use in [WEKA machine learning](https://weka.wikispaces.com/)

# usage

```javascript
var Arff = require('arff-utils');
var arff = new Arff.ArffWriter("relation name");
arff.addNumericAttribute("num");
arff.addStringAttribute("str");
arff.addNominalAttribute("nom", ["a", "b", "c"]);
arff.addDateAttribute("dt");
arff.addData([1,"s","a","2001-04-03 12:12:12"]);
arff.writeToStream(process.stdout);
```
# ctor
```new Arff.ArffWriter(relation[, mode][, options])```
* `relation` relation name
* `mode` [optional] if entering data manually with addData one must state the type of data that will be added. The type can be of [`Arff.MODE_OBJECT`, `Arff.MODE_ARRAY`, `Arff.MODE_CSV`]. default value is MODE_ARRAY. see below in [examples](#examples) for usage of each one.
* `options` [optional]
  * `reduce` an object mapping nominal values that should be transformed to a different value. For example `{ "false":"f" }` will transform all the nominal values "false" to "f" to instead
  * `skipRedundantNominal` boolean whether to skip nominal attributes with only a single value. If true these will be omitted from the final output. default is false.

# adding attributes

all attribute adding functions receive a string as the first parameter - the name of the attribute.

# addNumericAttribute
```javascript
arff.addNumericAttribute(name);
```
Add a new numeric attribute. This attribute can be of real or integer - it doesnt matter.

# addStringAttribute
```arff.addStringAttribute(name);```
Add a new string attribute.

# addNominalAttribute
```arff.addNominalAttribute(name, values);```
Adds a new nominal attribute. Receives an array of string values for this attribute as the second parameter.

# addDateAttribute
```arff.addDateAttribute(name[, format]);```
Adds a new date attribute. Receives an optional second parameter of type string as the date format as stated by the [arff specs](https://weka.wikispaces.com/ARFF).

# addData(data)
`data` should be in the format as specified in the constructor.
* for `MODE_ARRAY` (default) `data` should be an array exactly the size of the number of attributes
* for mode `MODE_OBJECT` `data` should be an object where the property keys are the attribute names and they must match the number of attributes exactly
* for mode `MODE_CSV` `data` should be a comma delimited string with the values matching exactly the number of attributes.

After addData is called for the first time you can not add any new attributes.

# writeToStream(stream)
writes the arff content into the supplied stream

# parseCsv(in, out[, options])
Given the data in csv format `parseCsv` will iterate thru the csv and output an arff file.

* `in` - filename or input stream to read csv from
* `out` - stream to write output arff
* `options` - [optional]
  * `start` - what line to start reading the input csv from (default is zero)
  * `count` - how many lines to read from the input csv (default is until the end)
  * `autoNominals` - boolean. If true nominal values will be automatically determined from the set of available values in the data. default is false.

# examples
```
var arff = new Arff.ArffWriter("myarff", Arff.MODE_OBJECT);
arff.addNumericAttribute("num");
arff.addStringAttribute("str");
arff.addNominalAttribute("nom", ["a", "b", "c d"]);
arff.addDateAttribute("dt");
arff.addDateAttribute("dtf", "yy mm dd");

arff.addData({
    num: 1,
    str: "s",
    nom: "a",
    dt: "2001-04-03 12:12:12",
    dtf: "2001-04-03 12:12:12"
});
arff.addData({
    num: 2,
    str: "s2",
    nom: "c d",
    dt: "2015-04-03 12:12:12",
    dtf: "2001-04-03 12:12:12"
});

arff.writeToStream(process.stdout);
```
```
var arff = new Arff.ArffWriter("myarff", Arff.MODE_ARRAY);
arff.addNumericAttribute("num");
arff.addStringAttribute("str");
arff.addNominalAttribute("nom", ["a", "b", "c d"]);
arff.addDateAttribute("dt");
arff.addDateAttribute("dtf", "yy mm dd");

arff.addData([1, "s", "a", "2001-04-03 12:12:12", "2001-04-03 12:12:12"]);
arff.addData([2, "s s", "c d", "2009-04-12 12:12:12", "2001-04-03 12:12:12"]);

arff.writeToStream(process.stdout);
```
```
var arff = new Arff.ArffWriter("myarff", Arff.MODE_CSV, {     
	reduce: {
        "c d": "c" 
    }
});
arff.addNumericAttribute("num");
arff.addStringAttribute("str");
arff.addNominalAttribute("nom", ["a", "b", "c d"]);
arff.addDateAttribute("dt");
arff.addDateAttribute("dtf", "yy mm dd");

arff.addData('1,s,a,"2001-04-03 12:12:12","2001-04-03 12:12:12"');
arff.addData('2,"s s","c d","2011-04-03 12:12:12","2001-04-03 12:12:12"');

arff.writeToStream(process.stdout);
```
```
var arff = new Arff.ArffWriter("parsearf");
arff.addNumericAttribute("num");
arff.addStringAttribute("str");
arff.addNominalAttribute("nom");
arff.addDateAttribute("dt");

//read lines 1 - 4 from test.csv and auto insert nominal values according to data:
arff.parseCsv('test.csv', process.stdout, {
    autoNominals: true,
    start: 1,
    count: 3
});
```
