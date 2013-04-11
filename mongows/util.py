def parse_arguments(arguemnts):
    """
    This functions parses the arguments, in the "k1:v1, k2:v2" to a dictionary
    of key value pairs
    """
    parsed_arguments = {}
    arguemts_list = arguemnts.split(",")
    for argument in arguemts_list:
        (key, value) = argument.split(":")
        # Key is always a string
        key = str(key)
        
        # If the value was expicitely received in quotes, it should be 
        # treated as a string. Otherwise, try to convert it to a number.
        if (value[0] == '"' or value[0] == "'" ):
            value = str(value[1:-1])
        else:
            value = try_number(value)
        
        parsed_arguments[key] = value
        
    return parsed_arguments

def try_number(input):
    """
    This function tries to convert a number into integer or float. If
    unsuccessful, it would return the string conversion of the input
    """
    if input.isdigit():
        return int(input)
    try:
        input = float(input)
        return input
    except ValueError:
        return str(input)
