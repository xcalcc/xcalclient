#
#  Copyright (C) 2021 Xcalibyte (Shenzhen) Limited.
#

import json
import logging
from common import CommonGlobals

try:
    from opentracing import tracer, tags, Format
    from jaeger_client import Config, Span
except:
    CommonGlobals.use_jaeger = False
    #logging.warn('Jaeger seems missing, skipping Jaeger initialization')
    class Span:
        pass

class XcalLogger(object):
    TRACE_LEVEL_DEBUG = 10
    TRACE_LEVEL_INFO = 20
    TRACE_LEVEL_WARN = 30
    TRACE_LEVEL_ERROR = 40
    TRACE_LEVEL_FATAL = 50

    # Self defined level
    XCAL_TRACE_LEVEL = 5

    def __init__(self, service_name: str, func_name: str, parent = None, external: Span = None,
                 debug_mode: bool = True, headers: dict = None, trace_id: str = '', span_id: str = ''):
        self.service_name = service_name
        self.func_name = func_name
        self.parent = parent

        self.debug_mode = debug_mode

        self.trace_id = trace_id
        self.span_id = span_id
        self.parent_span_id = ''
        self.sampled = '0'



        if headers is not None:
            self.trace_id = headers.get('X-B3-TraceId') or ''
            self.parent_span_id = headers.get('X-B3-SpanId') or ''

        self.current_span = None

        if CommonGlobals.use_jaeger and CommonGlobals.tracer is None:
            config = Config(
                config = {
                    'sampler': {
                        'type': 'const',
                        'param': 1
                    },
                    'local_agent': {
                        'reporting_host': CommonGlobals.jaeger_agent_host,
                        'reporting_port': CommonGlobals.jaeger_agent_port
                    },
                    'propagation': 'b3',
                    'logging': True
                },
                service_name = CommonGlobals.jaeger_service_name,
                validate = True
            )

            # this call also sets opentracing tracer
            CommonGlobals.tracer = config.initialize_tracer()

        if CommonGlobals.tracer is not None:
            parent_span = parent.current_span if isinstance(parent, XcalLogger) else external
            if parent_span is not None:
                self.parent_span_id = '%d' % parent_span.trace_id

            self.current_span = CommonGlobals.tracer.start_span('%s-%s' % (self.service_name, self.func_name), parent_span)
            if self.current_span is not None:
                if len(self.trace_id) == 0:
                    self.trace_id = ('%d' % self.current_span.trace_id)[0:16]
                self.span_id = ('%d' % self.current_span.span_id)[0:16]
                self.sampled = '1'

        self.headers = {
            'X-B3-TraceId': self.trace_id,
            'X-B3-SpanId': self.span_id,
            'X-B3-ParentSpanId': self.parent_span_id,
            'X-B3-Sampled': self.sampled,
            'traceId': self.trace_id,
            'spanId': self.span_id,
            'parentSpanId': self.parent_span_id,
            'spanExportable': self.sampled
        }
        if isinstance(parent, XcalLogger):
            self.headers.update(parent.headers)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.current_span is not None:
            self.current_span.__exit__(exc_type, exc_val, exc_tb)

    def finish(self):
        if self.current_span is not None:
            self.current_span.finish()

    def trace(self, operation_name: str, message: any):
        if self.debug_mode:
            self.log(self.XCAL_TRACE_LEVEL, operation_name, message)

    def debug(self, operation_name: str, message: any):
        if self.debug_mode:
            self.log(self.TRACE_LEVEL_DEBUG, operation_name, message)

    def info(self, operation_name: str, message: any):
        self.log(self.TRACE_LEVEL_INFO, operation_name, message)

    def warn(self, operation_name: str, message: any):
        self.log(self.TRACE_LEVEL_WARN, operation_name, message)

    def error(self, service_name: str, func_name: str, message: any):
        self.log(self.TRACE_LEVEL_ERROR, '%s-%s' % (service_name, func_name), message)

    def fatal(self, operation_name: str, message: any):
        self.log(self.TRACE_LEVEL_FATAL, operation_name, message)

    def log(self, level: int, operation_name: str, message: any):
        log_msg = '[{},{},{},{}] {}: {} {}'.format(
            self.service_name,
            self.trace_id,
            self.span_id,
            self.sampled,
            self.func_name,
            operation_name,
            message
        )
        logging.log(level, log_msg, extra = self.headers)
        if self.current_span is not None:
            self.current_span.log(level = level, msg = log_msg, extra = json.dumps(self.headers))

    def set_tag(self, key: str, value: str):
        if self.current_span is not None:
            self.current_span.set_tag(key, value)

    def set_debug_mode(self, debug_mode):
        self.debug_mode = debug_mode

class XcalLoggerExternalLinker(object):

    @staticmethod
    def prepare_server_span_scope_from_string(service_name: str, func_name: str, headers_string: str):
        """
        Read the injected info from the headers JSON string (e.g. from kafka).
        :param service_name:
        :param func_name:
        :param headers_string: A JSON-format string containing the info injected by prepare_client_request_headers()
        :return: XcalLogger for use
        """
        return XcalLoggerExternalLinker.prepare_server_span_scope(service_name, func_name, json.loads(headers_string))

    @staticmethod
    def prepare_server_span_scope(service_name: str, func_name: str, headers: dict):
        """
        Read the injected info from the headers (from HTTP request).
        :param service_name:
        :param func_name:
        :param headers:
        :return: XcalLogger for use
        """
        if not CommonGlobals.use_jaeger:
            return XcalLogger(service_name, func_name, headers = headers)

        logging.info('request header is %s' % headers)

        span_context = CommonGlobals.tracer.extract(Format.TEXT_MAP, dict(headers))
        logging.info('span context is %s' % span_context)

        if span_context is None:
            return XcalLogger(service_name, func_name, headers = headers)

        external = None
        if span_context is not None:
            scan_tag = {tags.SPAN_KIND: tags.SPAN_KIND_RPC_SERVER}
            logging.info('span tag is %s' % scan_tag)
            external = CommonGlobals.tracer.start_span('%s-%s' % (service_name, func_name), child_of = span_context, tags = scan_tag)

        return XcalLogger(service_name, func_name, external = external, headers = headers)

    @staticmethod
    def prepare_client_request_headers(url: str, http_method: str, logger: XcalLogger = None, headers: dict = {}):
        """
        Write the Jaeger related info to the header region.
        :param url: api url
        :param http_method: post/get/xxx
        :param logger:
        :param headers:
        :return: request headers, or {} if Jaeger is not used right now
        """
        if logger is not None:
            headers.update(logger.headers)

        if CommonGlobals.use_jaeger:
            logging.info('jaeger tracer object is %s' % CommonGlobals.tracer)
            logger.set_tag(tags.HTTP_URL, url)
            logger.set_tag(tags.HTTP_METHOD, http_method)
            logger.set_tag(tags.SPAN_KIND, tags.SPAN_KIND_RPC_CLIENT)
            CommonGlobals.tracer.inject(logger.current_span, Format.TEXT_MAP, headers)

        return headers

    @staticmethod
    def prepare_client_request_string(url: str, http_method: str, logger: XcalLogger):
        return json.dumps(XcalLoggerExternalLinker.prepare_client_request_headers(url, http_method, logger))
